import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ScoreInterval, StatisticSession, Student, ExportPrintConfig, createDefaultExportConfig } from '../types';
import { DEFAULT_10_INTERVALS, processStudentData, SAMPLE_TEACHERS, RAW_STUDENTS } from './sampleData';

// Helper to remove Vietnamese diacritics for flexible fuzzy matching
export function removeDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export interface ParsedExcelResult {
  fileName: string;
  fileSize: number;
  detectedHeaders: string[];
  recognizedSubjects: string[];
  missingColumns: string[];
  matchedColumns: {
    stt?: number;
    sbd?: number;
    soPhach?: number;
    name?: number;
    dob?: number;
    gender?: number;
    school?: number;
    grade?: number;
    className?: number;
    examRoom?: number;
    subjects: Record<string, number>; // subjectName -> colIndex
  };
  rawRowsCount: number;
  extractedStudents: Array<{
    stt: number;
    sbd: string;
    soPhach?: string;
    name: string;
    dob: string;
    gender: string;
    school: string;
    grade: string;
    className: string;
    examRoom?: string;
    scores: Record<string, number | null>;
  }>;
}

/**
 * Phân tích tệp Excel tải lên linh hoạt, hỗ trợ file thiếu cột
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error('Tệp Excel không có dữ liệu (trống)!');
  }

  // Convert to 2D array of rows
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
  if (rawRows.length < 2) {
    throw new Error('Tệp Excel quá ngắn hoặc không có dòng dữ liệu!');
  }

  // Find header row (search within first 10 rows)
  let headerRowIndex = 0;
  let maxScore = -1;

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    row.forEach((cell) => {
      const cellStr = removeDiacritics(String(cell || ''));
      if (['stt', 'so tt', 'tt'].includes(cellStr)) score += 3;
      if (['ho va ten', 'ho ten', 'ten', 'hoc sinh'].some((k) => cellStr.includes(k))) score += 4;
      if (['sbd', 'so bao danh', 'ma hs'].some((k) => cellStr.includes(k))) score += 3;
      if (['lop', 'ten lop', 'chi doan'].some((k) => cellStr.includes(k))) score += 3;
      if (['phong thi', 'phong', 'pt'].some((k) => cellStr.includes(k))) score += 3;
      if (['toan', 'ngu van', 'van', 'tieng anh', 'anh', 'tin', 'tin hoc', 'vat li', 'vat ly', 'hoa', 'sinh', 'su', 'dia'].some((k) => cellStr.includes(k))) score += 2;
    });

    if (score > maxScore) {
      maxScore = score;
      headerRowIndex = r;
    }
  }

  const headerRow = (rawRows[headerRowIndex] || []).map((c) => String(c || '').trim());

  // Map columns
  const matched = {
    stt: undefined as number | undefined,
    sbd: undefined as number | undefined,
    soPhach: undefined as number | undefined,
    name: undefined as number | undefined,
    dob: undefined as number | undefined,
    gender: undefined as number | undefined,
    school: undefined as number | undefined,
    grade: undefined as number | undefined,
    className: undefined as number | undefined,
    examRoom: undefined as number | undefined,
    subjects: {} as Record<string, number>,
  };

  const ignoredKeywords = ['tong diem', 'tong', 'diem tb', 'trung binh', 'xep thu', 'thu hang', 'ghi chu', 'rank', 'ket qua', 'hoc luc', 'hanh kiem'];

  headerRow.forEach((colName, colIdx) => {
    if (!colName) return;
    const clean = removeDiacritics(colName);

    if (matched.stt === undefined && (clean === 'stt' || clean === 'so tt' || clean === 'tt' || clean === 'no')) {
      matched.stt = colIdx;
      return;
    }

    if (matched.sbd === undefined && (clean === 'sbd' || clean.includes('so bao danh') || clean.includes('ma hs') || clean === 'sbd/mahs')) {
      matched.sbd = colIdx;
      return;
    }

    if (matched.soPhach === undefined && (clean === 'so phach' || clean === 'phach' || clean === 'ma phach' || clean.includes('so phach') || clean.includes('ma phach'))) {
      matched.soPhach = colIdx;
      return;
    }

    if (matched.name === undefined && (clean.includes('ho va ten') || clean.includes('ho ten') || clean.includes('ten hoc sinh') || clean === 'hoc sinh')) {
      matched.name = colIdx;
      return;
    }

    if (matched.dob === undefined && (clean.includes('ngay sinh') || clean === 'ns' || clean.includes('birth') || clean === 'dob')) {
      matched.dob = colIdx;
      return;
    }

    if (matched.gender === undefined && (clean.includes('gioi tinh') || clean === 'phai' || clean === 'gt' || clean === 'sex')) {
      matched.gender = colIdx;
      return;
    }

    if (matched.school === undefined && (clean.includes('truong') || clean.includes('don vi'))) {
      matched.school = colIdx;
      return;
    }

    if (matched.grade === undefined && (clean === 'khoi' || clean.includes('khoi lop'))) {
      matched.grade = colIdx;
      return;
    }

    if (matched.className === undefined && (clean === 'lop' || clean.includes('ten lop') || clean === 'chi doan')) {
      matched.className = colIdx;
      return;
    }

    if (matched.examRoom === undefined && (clean === 'phong thi' || clean === 'phong' || clean.includes('phong thi') || clean === 'pt' || clean === 'so phong')) {
      matched.examRoom = colIdx;
      return;
    }

    // Check if it's an ignored column
    const isIgnored = ignoredKeywords.some((ign) => clean.includes(ign));
    if (isIgnored) return;

    // Check if it's likely a subject score column
    matched.subjects[colName] = colIdx;
  });

  // Check missing columns for reporting
  const missingColumns: string[] = [];
  if (matched.name === undefined) missingColumns.push('Họ và tên (sẽ tự đặt tên mẫu)');
  if (matched.className === undefined) missingColumns.push('Lớp (sẽ tự xếp lớp mặc định)');

  // Extract student rows
  const extractedStudents: ParsedExcelResult['extractedStudents'] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if row has some content
    const hasData = row.some((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (!hasData) continue;

    const studentIdx = extractedStudents.length + 1;
    const stt = matched.stt !== undefined && row[matched.stt] ? parseInt(String(row[matched.stt]), 10) || studentIdx : studentIdx;
    const sbd = matched.sbd !== undefined && row[matched.sbd] ? String(row[matched.sbd]).trim() : '';
    const soPhach = matched.soPhach !== undefined && row[matched.soPhach] ? String(row[matched.soPhach]).trim() : '';
    const name = matched.name !== undefined && row[matched.name] ? String(row[matched.name]).trim() : `Học sinh ${studentIdx}`;
    const dob = matched.dob !== undefined && row[matched.dob] ? String(row[matched.dob]).trim() : '';
    const gender = matched.gender !== undefined && row[matched.gender] ? String(row[matched.gender]).trim() : '';
    const school = matched.school !== undefined && row[matched.school] ? String(row[matched.school]).trim() : '';
    const className = matched.className !== undefined && row[matched.className] ? String(row[matched.className]).trim() : 'Lớp 1';
    const examRoom = matched.examRoom !== undefined && row[matched.examRoom] ? String(row[matched.examRoom]).trim() : '';
    
    let grade = matched.grade !== undefined && row[matched.grade] ? String(row[matched.grade]).trim() : '';
    if (!grade && className) {
      const match = className.match(/^(\d+)/);
      grade = match ? `Khối ${match[1]}` : 'Khối chung';
    }

    // Extract subject scores
    const scores: Record<string, number | null> = {};
    Object.entries(matched.subjects).forEach(([subName, colIdx]) => {
      const rawVal = row[colIdx];
      if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
        scores[subName] = null;
      } else {
        const num = parseFloat(String(rawVal).replace(',', '.'));
        scores[subName] = isNaN(num) ? null : Math.min(10, Math.max(0, Math.round(num * 100) / 100));
      }
    });

    extractedStudents.push({
      stt,
      sbd,
      soPhach,
      name,
      dob,
      gender,
      school,
      grade,
      className,
      examRoom,
      scores,
    });
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    detectedHeaders: headerRow,
    recognizedSubjects: Object.keys(matched.subjects),
    missingColumns,
    matchedColumns: matched,
    rawRowsCount: extractedStudents.length,
    extractedStudents,
  };
}

export interface AvailableColumnDef {
  key: string;
  label: string;
  headerName: string;
  group: 'info' | 'subject';
  isSubject?: boolean;
  required?: boolean;
  width: number;
}

export const AVAILABLE_TEMPLATE_COLUMNS: AvailableColumnDef[] = [
  { key: 'stt', label: 'STT', headerName: 'STT', group: 'info', width: 6 },
  { key: 'sbd', label: 'Số báo danh', headerName: 'Số báo danh', group: 'info', width: 16 },
  { key: 'soPhach', label: 'Số phách', headerName: 'Số phách', group: 'info', width: 14 },
  { key: 'name', label: 'Họ và tên', headerName: 'Họ và tên', group: 'info', required: true, width: 25 },
  { key: 'dob', label: 'Ngày sinh', headerName: 'Ngày sinh', group: 'info', width: 14 },
  { key: 'gender', label: 'Giới tính', headerName: 'Giới tính', group: 'info', width: 10 },
  { key: 'school', label: 'Trường', headerName: 'Trường', group: 'info', width: 24 },
  { key: 'className', label: 'Lớp', headerName: 'Lớp', group: 'info', width: 10 },
  { key: 'toan', label: 'Toán', headerName: 'Toán', group: 'subject', isSubject: true, width: 10 },
  { key: 'van', label: 'Ngữ văn', headerName: 'Ngữ văn', group: 'subject', isSubject: true, width: 10 },
  { key: 'anh', label: 'Tiếng Anh', headerName: 'Tiếng Anh', group: 'subject', isSubject: true, width: 11 },
];

export interface CustomExcelTemplateOptions {
  schoolName: string;
  examTitle: string;
  academicYear: string;
  selectedColumnKeys: string[];
  customSubjects?: string[];
  includeSampleRows: boolean;
  sampleRowCount?: number;
  fileName?: string;
}

export const SAMPLE_STUDENTS_FOR_TEMPLATE = [
  {
    stt: 1,
    sbd: 'BD0001',
    soPhach: 'P-001',
    name: 'NGUYỄN HOÀNG LONG',
    dob: '15/03/2012',
    gender: 'Nam',
    school: 'Trường THCS Thư Vũ',
    className: '9A1',
    scores: { 'Toán': 8.5, 'Ngữ văn': 8.0, 'Tiếng Anh': 9.0 } as Record<string, number>,
  },
  {
    stt: 2,
    sbd: 'BD0002',
    soPhach: 'P-002',
    name: 'TRẦN THỊ MAI ANH',
    dob: '22/07/2012',
    gender: 'Nữ',
    school: 'Trường THCS Thư Vũ',
    className: '9A1',
    scores: { 'Toán': 9.0, 'Ngữ văn': 8.5, 'Tiếng Anh': 9.5 } as Record<string, number>,
  },
  {
    stt: 3,
    sbd: 'BD0003',
    soPhach: 'P-003',
    name: 'LÊ HOÀNG ANH',
    dob: '10/11/2012',
    gender: 'Nam',
    school: 'Trường THCS Thư Vũ',
    className: '9A2',
    scores: { 'Toán': 7.5, 'Ngữ văn': 7.0, 'Tiếng Anh': 8.0 } as Record<string, number>,
  },
  {
    stt: 4,
    sbd: 'BD0004',
    soPhach: 'P-004',
    name: 'PHẠM THU TRANG',
    dob: '05/01/2012',
    gender: 'Nữ',
    school: 'Trường THCS Thư Vũ',
    className: '9A2',
    scores: { 'Toán': 9.5, 'Ngữ văn': 9.0, 'Tiếng Anh': 8.5 } as Record<string, number>,
  },
  {
    stt: 5,
    sbd: 'BD0005',
    soPhach: 'P-005',
    name: 'VŨ ĐỨC HẢI',
    dob: '18/09/2012',
    gender: 'Nam',
    school: 'Trường THCS Thư Vũ',
    className: '9A3',
    scores: { 'Toán': 8.0, 'Ngữ văn': 7.5, 'Tiếng Anh': 7.5 } as Record<string, number>,
  },
];

/**
 * Tải tệp mẫu Excel tự tùy chọn cột (Customizable Template Builder)
 */
export function downloadCustomExcelTemplate(options: CustomExcelTemplateOptions) {
  const {
    schoolName = 'Trường THCS Thư Vũ',
    examTitle = 'DANH SÁCH VÀO ĐIỂM HỌC SINH (MẪU TÙY CHỌN)',
    academicYear = '2026 - 2027',
    selectedColumnKeys = ['stt', 'sbd', 'soPhach', 'name', 'dob', 'gender', 'school', 'className', 'toan', 'van', 'anh'],
    customSubjects = [],
    includeSampleRows = true,
    sampleRowCount = 30,
    fileName,
  } = options;

  const wb = XLSX.utils.book_new();

  // Gather column definitions
  const columnDefs: Array<{ key: string; label: string; width: number; isSubject?: boolean }> = [];
  selectedColumnKeys.forEach((k) => {
    const found = AVAILABLE_TEMPLATE_COLUMNS.find((c) => c.key === k);
    if (found) {
      columnDefs.push({
        key: found.key,
        label: found.headerName,
        width: found.width,
        isSubject: found.isSubject,
      });
    }
  });

  // Add custom subjects if any
  customSubjects.forEach((sub) => {
    const trimmed = sub.trim();
    if (trimmed && !columnDefs.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())) {
      columnDefs.push({
        key: `custom_${trimmed}`,
        label: trimmed,
        width: Math.max(10, trimmed.length + 3),
        isSubject: true,
      });
    }
  });

  if (columnDefs.length === 0) {
    columnDefs.push(
      { key: 'stt', label: 'STT', width: 6 },
      { key: 'name', label: 'Họ và tên', width: 25 },
      { key: 'className', label: 'Lớp', width: 10 }
    );
  }

  const numCols = Math.max(columnDefs.length, 6);
  const midCol = Math.floor(numCols / 2);

  // Row 0 & 1: National Header & School Name
  const r0 = new Array(numCols).fill('');
  r0[0] = 'SỞ GIÁO DỤC VÀ ĐÀO TẠO';
  r0[midCol] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';

  const r1 = new Array(numCols).fill('');
  r1[0] = (schoolName || 'TRƯỜNG THCS THƯ VŨ').toUpperCase();
  r1[midCol] = 'Độc lập - Tự do - Hạnh phúc';

  const r2: string[] = [];
  const r3 = [examTitle.toUpperCase()];
  const r4 = [`Năm học: ${academicYear} | Đơn vị: ${schoolName}`];
  const r5: string[] = [];
  const r6 = columnDefs.map((c) => c.label);

  // Data rows
  let dataRows: any[][] = [];
  if (includeSampleRows) {
    dataRows = SAMPLE_STUDENTS_FOR_TEMPLATE.map((st, idx) => {
      return columnDefs.map((col) => {
        if (col.key === 'stt') return idx + 1;
        if (col.key === 'sbd') return st.sbd;
        if (col.key === 'soPhach') return st.soPhach;
        if (col.key === 'name') return st.name;
        if (col.key === 'dob') return st.dob;
        if (col.key === 'gender') return st.gender;
        if (col.key === 'school') return schoolName || st.school;
        if (col.key === 'className') return st.className;
        if (col.key === 'toan') return st.scores['Toán'];
        if (col.key === 'van') return st.scores['Ngữ văn'];
        if (col.key === 'anh') return st.scores['Tiếng Anh'];
        if (col.isSubject) {
          const base = 7.5 + ((idx * 3) % 4) * 0.5;
          return Math.min(10, base);
        }
        return '';
      });
    });
  } else {
    for (let i = 1; i <= sampleRowCount; i++) {
      const row = columnDefs.map((col) => (col.key === 'stt' ? i : ''));
      dataRows.push(row);
    }
  }

  const wsData = [r0, r1, r2, r3, r4, r5, r6, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: midCol - 1 } },
    { s: { r: 0, c: midCol }, e: { r: 0, c: columnDefs.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: midCol - 1 } },
    { s: { r: 1, c: midCol }, e: { r: 1, c: columnDefs.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: columnDefs.length - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: columnDefs.length - 1 } },
  ];
  ws['!merges'] = merges;

  ws['!cols'] = columnDefs.map((c) => ({ wch: c.width }));
  ws['!rows'] = [
    { hpt: 18 },
    { hpt: 20 },
    { hpt: 8 },
    { hpt: 26 },
    { hpt: 18 },
    { hpt: 8 },
    { hpt: 26 }, // Header row
  ];

  // Borders
  const borderThin = {
    top: { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
    left: { style: 'thin', color: { rgb: 'D1D5DB' } },
    right: { style: 'thin', color: { rgb: 'D1D5DB' } },
  };

  // Style Title & Headers
  applyCellStyle(ws, 0, 0, {
    font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '374151' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  applyCellStyle(ws, 0, midCol, {
    font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '111827' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  applyCellStyle(ws, 1, 0, {
    font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  applyCellStyle(ws, 1, midCol, {
    font: { name: 'Times New Roman', sz: 10, italic: true, bold: true, color: { rgb: '374151' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });

  applyCellStyle(ws, 3, 0, {
    font: { name: 'Times New Roman', sz: 14, bold: true, color: { rgb: '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  applyCellStyle(ws, 4, 0, {
    font: { name: 'Times New Roman', sz: 10.5, italic: true, color: { rgb: '4B5563' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });

  // Header row (row 6)
  for (let c = 0; c < columnDefs.length; c++) {
    applyCellStyle(ws, 6, c, {
      font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    });
  }

  // Data rows (starting row 7)
  for (let r = 0; r < dataRows.length; r++) {
    const rowIdx = 7 + r;
    const isEven = r % 2 === 0;
    for (let c = 0; c < columnDefs.length; c++) {
      const colDef = columnDefs[c];
      const isTextCol = colDef.key === 'name' || colDef.key === 'school';
      applyCellStyle(ws, rowIdx, c, {
        font: { name: 'Times New Roman', sz: 10, color: { rgb: '111827' } },
        fill: { patternType: 'solid', fgColor: { rgb: isEven ? 'FFFFFF' : 'F9FAFB' } },
        border: borderThin,
        alignment: {
          horizontal: isTextCol ? 'left' : 'center',
          vertical: 'center',
        },
      });
    }
  }

  // Page setup
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
  };
  ws['!margins'] = { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  if (!ws['!sheetPr']) ws['!sheetPr'] = {};
  ws['!sheetPr'].pageSetUpPr = { fitToPage: true };
  ws['!sheetViews'] = [{ showGridLines: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Diem');

  const cleanFileName = fileName || `Mau_Nhap_Diem_${(schoolName || 'THCS_Thu_Vu').replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, cleanFileName);
}

/**
 * Tải tệp mẫu Excel chuẩn theo đúng tệp: "tệp mẫu nhập điểm kiểm tra.pdf"
 * Cấu trúc cột: STT | số báo danh | Họ và tên | Ngày sinh | Lớp | Phòng thi | Toán | văn | Anh | Tin
 * Kèm dữ liệu mẫu thực tế của học sinh NGUYỄN HOÀNG LONG (SBD: 10000030, Lớp 9D1, Phòng 901)
 * và các dòng trống 2 - 41 để giáo viên nhập liệu trực tiếp
 */
export function downloadSampleStudentExcel() {
  const wb = XLSX.utils.book_new();

  // Tiêu đề cơ quan & Quốc hiệu theo chuẩn Trường THCS Thư Vũ
  const r1 = ['', 'SỞ GIÁO DỤC VÀ ĐÀO TẠO', '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'];
  const r2 = ['', 'TRƯỜNG THCS THƯ VŨ', '', '', '', 'Độc lập - Tự do - Hạnh phúc'];
  const r3: string[] = [];
  const r4 = ['DANH SÁCH VÀO ĐIỂM HỌC SINH (CHUẨN MẪU NHẬP ĐIỂM KIỂM TRA)'];
  const r5 = ['Kỳ kiểm tra: Kiểm tra giữa học kỳ 1 - năm học 2026-2027 | Đơn vị: Trường THCS Thư Vũ'];
  const r6: string[] = [];

  // Cột chuẩn xác 100% như trong file tệp mẫu nhập điểm kiểm tra.pdf
  const headers = [
    'STT',
    'số báo danh',
    'Họ và tên',
    'Ngày sinh',
    'Lớp',
    'Phòng thi',
    'Toán',
    'văn',
    'Anh',
    'Tin',
  ];

  // Dữ liệu mẫu 169 học sinh của 5 lớp Trường THCS Thư Vũ
  const sampleRows: any[][] = RAW_STUDENTS.map((st, idx) => [
    idx + 1,
    st.sbd,
    st.name,
    st.dob,
    st.className,
    st.examRoom ? parseInt(st.examRoom, 10) || st.examRoom : '',
    st.scores['Toán'] ?? '',
    st.scores['Văn'] ?? '',
    st.scores['Anh'] ?? '',
    st.scores['Tin'] ?? '',
  ]);

  // Kết hợp dòng tiêu đề, dòng trống và bảng dữ liệu
  const wsData = [
    r1,
    r2,
    r3,
    r4,
    r5,
    r6,
    headers,
    ...sampleRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Cài đặt độ rộng cột tối ưu
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 16 }, // số báo danh
    { wch: 25 }, // Họ và tên
    { wch: 14 }, // Ngày sinh
    { wch: 10 }, // Lớp
    { wch: 12 }, // Phòng thi
    { wch: 9 },  // Toán
    { wch: 9 },  // văn
    { wch: 9 },  // Anh
    { wch: 9 },  // Tin
  ];

  // Chiều cao các dòng
  ws['!rows'] = [
    { hpt: 18 }, // Dòng 1: SỞ GIÁO DỤC
    { hpt: 20 }, // Dòng 2: TRƯỜNG THCS THƯ VŨ
    { hpt: 8 },
    { hpt: 26 }, // Title DANH SÁCH VÀO ĐIỂM HỌC SINH
    { hpt: 18 }, // Subtitle Kỳ kiểm tra
    { hpt: 8 },
    { hpt: 24 }, // Header cột
  ];

  // Căn chỉnh trang in A4 Landscape vừa khít 1 trang ngang để cột Tin KHÔNG bị tràn sang trang 2
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
  };

  ws['!margins'] = {
    left: 0.35,
    right: 0.35,
    top: 0.45,
    bottom: 0.45,
    header: 0.2,
    footer: 0.2,
  };

  if (!ws['!sheetPr']) ws['!sheetPr'] = {};
  ws['!sheetPr'].pageSetUpPr = { fitToPage: true };
  ws['!sheetViews'] = [{ showGridLines: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'Vao_Diem_Hoc_Sinh');
  XLSX.writeFile(wb, 'Mau_Danh_Sach_Diem_Hoc_Sinh.xlsx');
}

/**
 * Tải tệp mẫu 2: Bảng thống kê điểm theo trường, lớp, môn
 */
export function downloadSampleStatsTemplateExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Thống kê toàn trường
  const schoolHeaders = [
    'Môn học',
    'Số bài thi',
    'Điểm TB',
    'Điểm Max',
    'Điểm Min',
    '0 - <1',
    '1 - <2',
    '2 - <3',
    '3 - <4',
    '4 - <5',
    '5 - <6',
    '6 - <7',
    '7 - <8',
    '8 - <9',
    '9 - 10',
    'Đạt (>=5.0)',
    'Tỉ lệ đạt %',
    'Giỏi (>=8.0)',
    'Tỉ lệ giỏi %',
  ];

  const sampleStatsRows = [
    ['Toán', 30, 7.85, 9.8, 3.5, 0, 0, 0, 1, 2, 4, 6, 7, 6, 4, 27, '90.0%', 10, '33.3%'],
    ['Ngữ văn', 30, 7.62, 9.5, 4.5, 0, 0, 0, 0, 1, 3, 5, 8, 9, 4, 29, '96.7%', 13, '43.3%'],
    ['Tiếng Anh', 30, 7.95, 9.8, 4.0, 0, 0, 0, 0, 2, 3, 4, 7, 8, 6, 28, '93.3%', 14, '46.7%'],
    ['Vật lí', 30, 7.24, 9.5, 3.5, 0, 0, 0, 1, 2, 5, 8, 7, 5, 2, 27, '90.0%', 7, '23.3%'],
    ['Hóa học', 30, 7.38, 9.75, 3.25, 0, 0, 0, 1, 2, 4, 7, 8, 5, 3, 27, '90.0%', 8, '26.7%'],
  ];

  const wsSchool = XLSX.utils.aoa_to_sheet([
    ['BẢNG THỐNG KÊ ĐIỂM TOÀN TRƯỜNG THEO CÁC MỐC TIÊU CHUẨN'],
    ['Năm học: 2026 - 2027 | Đơn vị: Trường THCS Thư Vũ'],
    [],
    schoolHeaders,
    ...sampleStatsRows,
  ]);

  XLSX.utils.book_append_sheet(wb, wsSchool, 'ThongKe_ToanTruong');
  XLSX.writeFile(wb, 'Mau_Thong_Ke_Diem_Theo_Tieu_Chuan.xlsx');
}

// Styling constants for Excel export (xlsx-js-style)
const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: '4B5563' } },
  bottom: { style: 'thin', color: { rgb: '4B5563' } },
  left: { style: 'thin', color: { rgb: '4B5563' } },
  right: { style: 'thin', color: { rgb: '4B5563' } },
};

const BORDER_DOUBLE_BOTTOM = {
  top: { style: 'thin', color: { rgb: '4B5563' } },
  bottom: { style: 'double', color: { rgb: '111827' } },
  left: { style: 'thin', color: { rgb: '4B5563' } },
  right: { style: 'thin', color: { rgb: '4B5563' } },
};

const FILL_HEADER = { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } };
const FILL_TOTAL_HEADER = { patternType: 'solid', fgColor: { rgb: 'E0E7FF' } };
const FILL_CLASS_RANK_HEADER = { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } };
const FILL_SCHOOL_RANK_HEADER = { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } };

const FILL_TOTAL_DATA = { patternType: 'solid', fgColor: { rgb: 'EEF2FF' } };
const FILL_CLASS_RANK_DATA = { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } };
const FILL_SCHOOL_RANK_DATA = { patternType: 'solid', fgColor: { rgb: 'FFFBEB' } };
const FILL_BANNER = { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } };

function applyCellStyle(ws: XLSX.WorkSheet, r: number, c: number, style: any) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) {
    ws[addr] = { t: 's', v: '' };
  }
  ws[addr].s = {
    ...(ws[addr].s || {}),
    ...style,
  };
}

/**
 * Xây dựng worksheet chi tiết cho một lớp học theo cấu hình tùy chọn:
 * 1. Lựa chọn các cột học sinh cần xuất (Bảng II)
 * 2. Lựa chọn các tiêu chuẩn thống kê cần in (Bảng I) hoặc ẩn Bảng I
 * 3. Hướng giấy in: Khổ ngang (Landscape) hoặc Khổ dọc (Portrait), Khổ A4/A3/Letter
 * 4. Tự động co dãn căn chỉnh toàn bộ các dòng tiêu đề (Sở GD, Tên trường, Quốc hiệu, Tiêu đề chính, Kỳ thi, Banner GVCN & Sĩ số, Mục I, Mục II)
 *    vừa khít chính xác với số lượng cột được chọn (từ cột 0 đến numColumns - 1), không bị lệch hoặc thừa cột
 * 5. Kẻ đầy đủ đường viền ô (border) cho mọi ô dữ liệu
 * 6. Tự động lặp lại dòng tiêu đề cột trên mọi trang in khi danh sách kéo dài sang trang 2, 3...
 */
export function buildCustomClassWorksheet(
  session: StatisticSession,
  cName: string,
  config: ExportPrintConfig,
  options?: {
    isOverall?: boolean;
    targetStudents?: Student[];
    targetClassesCount?: number;
    customTitle?: string;
    customSheetName?: string;
  }
) {
  const isOverall = !!options?.isOverall;
  const classSummary = isOverall ? null : session.classSummaries[cName];
  const classStudents = isOverall
    ? (options?.targetStudents || [...session.students]).sort((a, b) => a.schoolRank - b.schoolRank)
    : session.students
        .filter((s) => s.className === cName)
        .sort((a, b) => a.classRank - b.classRank);

  const hasRooms = session.students.some((s) => s.examRoom);

  // 1. Xác định danh sách cột học sinh (Bảng II)
  interface ActiveCol {
    key: string;
    label: string;
    baseWidth: number;
    align: 'left' | 'center' | 'right';
    isTotal?: boolean;
    isAvg?: boolean;
    isClassRank?: boolean;
    isSchoolRank?: boolean;
    getValue: (st: Student, idx: number) => any;
  }

  const activeCols: ActiveCol[] = [];

  if (config.columns.stt) {
    activeCols.push({ key: 'stt', label: 'STT', baseWidth: 6, align: 'center', getValue: (_, idx) => idx + 1 });
  }
  if (config.columns.sbd) {
    activeCols.push({ key: 'sbd', label: 'Số báo danh', baseWidth: 14, align: 'center', getValue: (st) => st.sbd });
  }
  if (config.columns.name) {
    activeCols.push({ key: 'name', label: 'Họ và tên', baseWidth: 24, align: 'left', getValue: (st) => st.name });
  }
  if (config.columns.dob) {
    activeCols.push({ key: 'dob', label: 'Ngày sinh', baseWidth: 13, align: 'center', getValue: (st) => st.dob || '' });
  }
  if (config.columns.examRoom && hasRooms) {
    activeCols.push({ key: 'examRoom', label: 'Phòng thi', baseWidth: 11, align: 'center', getValue: (st) => st.examRoom || '' });
  }
  if (config.columns.gender) {
    activeCols.push({ key: 'gender', label: 'Giới tính', baseWidth: 8, align: 'center', getValue: (st) => st.gender || '' });
  }
  if (config.columns.className || isOverall) {
    activeCols.push({ key: 'className', label: 'Lớp', baseWidth: 9, align: 'center', getValue: (st) => st.className });
  }
  if (config.columns.grade) {
    activeCols.push({ key: 'grade', label: 'Khối', baseWidth: 9, align: 'center', getValue: (st) => st.grade || '' });
  }

  // Điểm các môn được chọn
  session.subjects.forEach((sub) => {
    if (config.columns.subjects[sub] !== false) {
      activeCols.push({
        key: `sub_${sub}`,
        label: sub,
        baseWidth: 9,
        align: 'center',
        getValue: (st) => (st.scores[sub] !== null && st.scores[sub] !== undefined ? st.scores[sub] : ''),
      });
    }
  });

  if (config.columns.totalScore) {
    activeCols.push({ key: 'totalScore', label: 'Tổng điểm', baseWidth: 11, align: 'right', isTotal: true, getValue: (st) => st.totalScore });
  }
  if (config.columns.averageScore) {
    activeCols.push({ key: 'averageScore', label: 'Điểm TB', baseWidth: 9.5, align: 'right', isAvg: true, getValue: (st) => st.averageScore });
  }
  if (config.columns.classRank) {
    activeCols.push({ key: 'classRank', label: 'Thứ Lớp', baseWidth: 11, align: 'center', isClassRank: true, getValue: (st) => st.classRank });
  }
  if (config.columns.schoolRank) {
    activeCols.push({ key: 'schoolRank', label: 'Thứ Trường', baseWidth: 12, align: 'center', isSchoolRank: true, getValue: (st) => st.schoolRank });
  }
  if (config.columns.notes) {
    activeCols.push({ key: 'notes', label: 'Ghi chú', baseWidth: 14, align: 'left', getValue: (st) => st.notes || '' });
  }

  if (activeCols.length === 0) {
    activeCols.push({ key: 'name', label: 'Họ và tên', baseWidth: 24, align: 'left', getValue: (st) => st.name });
  }

  const numColumns = activeCols.length;

  // 2. Xác định danh sách cột Bảng I (nếu bật)
  interface Table1Col {
    key: string;
    label: string;
    getValue: (stats: any) => any;
    isAvg?: boolean;
    isMax?: boolean;
    isDat?: boolean;
    isGioi?: boolean;
  }

  const table1Cols: Table1Col[] = [
    { key: 'subject', label: 'Môn học', getValue: (s) => s.subjectName },
  ];

  if (config.summaryCriteria.count) {
    table1Cols.push({ key: 'count', label: 'Số bài', getValue: (s) => s.count });
  }
  if (config.summaryCriteria.avgScore) {
    table1Cols.push({ key: 'avgScore', label: 'Điểm TB', isAvg: true, getValue: (s) => s.avgScore });
  }
  if (config.summaryCriteria.maxScore) {
    table1Cols.push({ key: 'maxScore', label: 'Max', isMax: true, getValue: (s) => s.maxScore });
  }
  if (config.summaryCriteria.minScore) {
    table1Cols.push({ key: 'minScore', label: 'Min', getValue: (s) => s.minScore });
  }

  session.intervals.forEach((inv) => {
    if (config.summaryCriteria.intervals[inv.id] !== false) {
      table1Cols.push({
        key: `inv_${inv.id}`,
        label: inv.label,
        getValue: (s) => `${s.intervalCounts[inv.id] || 0} (${s.intervalPercents[inv.id] || 0}%)`,
      });
    }
  });

  if (config.summaryCriteria.above5) {
    table1Cols.push({ key: 'above5Count', label: 'Đạt (>=5)', isDat: true, getValue: (s) => s.above5Count });
    table1Cols.push({ key: 'above5Percent', label: '% Đạt', isDat: true, getValue: (s) => `${s.above5Percent}%` });
  }
  if (config.summaryCriteria.above8) {
    table1Cols.push({ key: 'above8Count', label: 'Giỏi (>=8)', isGioi: true, getValue: (s) => s.above8Count });
    table1Cols.push({ key: 'above8Percent', label: '% Giỏi', isGioi: true, getValue: (s) => `${s.above8Percent}%` });
  }

  // 3. Xây dựng các dòng dữ liệu
  const sheetRows: any[][] = [];

  // Tính toán vùng căn chỉnh cho Quốc hiệu, Tiêu ngữ và Cơ quan ban hành:
  // - Bên trái: SỞ GIÁO DỤC VÀ ĐÀO TẠO / TRƯỜNG: ... / Đơn vị lưu trữ (chiếm ~33-38% chiều rộng, như cột A, B, C trong ảnh)
  // - Cột đệm (Spacer): Cột ở giữa (như cột D trong ảnh) để ngăn cách rõ ràng hai bên
  // - Bên phải: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc (chiếm ~50-55% chiều rộng, kéo dài đến hết lề phải trang in như cột E..I trong ảnh)
  const rawTotalWidth = activeCols.reduce((sum, c) => sum + c.baseWidth, 0);
  const leftStart = 0;
  let leftEnd = 0;
  let accumW = 0;
  const targetLeftW = rawTotalWidth * 0.35; // Khoảng 35% độ rộng trang in

  for (let i = 0; i < numColumns; i++) {
    accumW += activeCols[i].baseWidth;
    if (accumW >= targetLeftW || i >= Math.floor(numColumns / 2) - 1) {
      leftEnd = Math.max(1, Math.min(i, Math.floor(numColumns / 2) - 1));
      break;
    }
  }

  // Đảm bảo khối bên trái không lấn qua nửa trang
  if (leftEnd >= Math.floor(numColumns / 2)) {
    leftEnd = Math.max(0, Math.floor(numColumns / 2) - 1);
  }

  // Cột đệm phân cách và vị trí bắt đầu của Quốc hiệu bên phải
  let rightStart = leftEnd + 1;
  if (numColumns >= 7 && (numColumns - 1 - (leftEnd + 2)) >= 2) {
    rightStart = leftEnd + 2; // Cột (leftEnd + 1) để trống hoàn toàn làm khoảng đệm như cột D trong hình mẫu
  }
  const rightEnd = numColumns - 1;

  // Row 0: Sở GD (Trái) & Quốc hiệu (Phải)
  const row0 = new Array(numColumns).fill('');
  row0[leftStart] = config.customInfo?.departmentName || `SỞ GIÁO DỤC VÀ ĐÀO TẠO`;
  row0[rightStart] = config.customInfo?.mottoTitle || `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM`;
  sheetRows.push(row0);

  // Row 1: Tên Trường (Trái) & Tiêu ngữ (Phải)
  const row1 = new Array(numColumns).fill('');
  const cleanSchool = (config.customInfo?.schoolName || session.schoolName).trim().toUpperCase();
  const schoolDisplayText = cleanSchool.startsWith('TRƯỜNG:')
    ? cleanSchool
    : `TRƯỜNG: ${cleanSchool}`;
  row1[leftStart] = schoolDisplayText;
  row1[rightStart] = config.customInfo?.mottoSubTitle || `Độc lập - Tự do - Hạnh phúc`;
  sheetRows.push(row1);

  // Row 2: Ghi chú lưu trữ (Trái)
  const row2 = new Array(numColumns).fill('');
  row2[leftStart] = config.customInfo?.documentSubTitle || `Đơn vị lưu trữ hồ sơ khảo sát`;
  sheetRows.push(row2);

  // Row 3: Blank spacer
  sheetRows.push(new Array(numColumns).fill(''));

  // Row 4: Tiêu đề chính
  const row4 = new Array(numColumns).fill('');
  row4[0] = isOverall
    ? (options?.customTitle || 'BẢNG KẾT QUẢ ĐIỂM TỔNG HỢP - TẤT CẢ CÁC LỚP')
    : `BẢNG KẾT QUẢ ĐIỂM & THỐNG KÊ CHI TIẾT - LỚP ${cName.toUpperCase()}`;
  sheetRows.push(row4);

  // Row 5: Kỳ thi
  const row5 = new Array(numColumns).fill('');
  row5[0] = `Kỳ thi: ${session.name}  |  Năm học: ${session.academicYear}`;
  sheetRows.push(row5);

  // Row 6: Thông tin GVCN & Sĩ số hoặc Tổng số học sinh & lớp
  const row6 = new Array(numColumns).fill('');
  if (isOverall) {
    const totalAvg = classStudents.length > 0
      ? (classStudents.reduce((acc, s) => acc + s.averageScore, 0) / classStudents.length).toFixed(2)
      : '0';
    const classesCount = options?.targetClassesCount || session.classes.length;
    row6[0] = `Quy mô: Toàn bộ học sinh    |    Sĩ số: ${classStudents.length} học sinh    |    Tổng số lớp: ${classesCount} lớp    |    Điểm TB chung: ${totalAvg}`;
  } else {
    row6[0] = `Giáo viên chủ nhiệm: ${classSummary?.homeroomTeacher || '...............................'}    |    Sĩ số: ${classStudents.length} học sinh    |    Khối: ${classSummary?.grade || ''}    |    Điểm TB lớp: ${classSummary?.avgTotalScore || 0}`;
  }
  sheetRows.push(row6);

  // Row 7: Blank
  sheetRows.push(new Array(numColumns).fill(''));

  let table1HeaderRowIndex = -1;
  let table1StartRow = -1;
  let table1EndRow = -1;

  if (config.showSummaryTable && table1Cols.length > 1) {
    // Row 8: Tiêu đề mục I
    const row8 = new Array(numColumns).fill('');
    row8[0] = isOverall
      ? `I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN (TOÀN TRƯỜNG / TỔNG HỢP)`
      : `I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN CỦA LỚP`;
    sheetRows.push(row8);

    // Header Bảng I
    table1HeaderRowIndex = sheetRows.length;
    const t1Header = new Array(numColumns).fill('');
    table1Cols.forEach((col, idx) => {
      if (idx < numColumns) t1Header[idx] = col.label;
    });
    sheetRows.push(t1Header);

    table1StartRow = sheetRows.length;
    session.subjects.forEach((sub) => {
      if (config.columns.subjects[sub] === false) return;
      const s = isOverall ? session.overallStats[sub] : classSummary?.subjectStats[sub];
      const row = new Array(numColumns).fill('');
      if (s) {
        table1Cols.forEach((col, idx) => {
          if (idx < numColumns) row[idx] = col.getValue(s);
        });
      } else {
        row[0] = sub;
      }
      sheetRows.push(row);
    });
    table1EndRow = sheetRows.length - 1;

    // Blank separator
    sheetRows.push(new Array(numColumns).fill(''));
  }

  // Tiêu đề mục II (Danh sách học sinh)
  const sec2RowIndex = sheetRows.length;
  const rowSec2 = new Array(numColumns).fill('');
  const roman2 = config.showSummaryTable ? 'II. ' : '';
  rowSec2[0] = isOverall
    ? `${roman2}DANH SÁCH CHI TIẾT HỌC SINH TẤT CẢ CÁC LỚP (CÓ XẾP THỨ TRƯỜNG & LỚP)`
    : `${roman2}DANH SÁCH CHI TIẾT HỌC SINH LỚP ${cName.toUpperCase()} (CÓ XẾP THỨ LỚP & TRƯỜNG)`;
  sheetRows.push(rowSec2);

  // Header Bảng II
  const table2HeaderRowIndex = sheetRows.length;
  const t2Header = activeCols.map((c) => c.label);
  sheetRows.push(t2Header);
  const studentHeaderRowNumber = table2HeaderRowIndex + 1; // 1-indexed for Excel print titles

  // Bảng II data rows
  const table2StartRow = sheetRows.length;
  classStudents.forEach((st, idx) => {
    const row = activeCols.map((c) => c.getValue(st, idx));
    sheetRows.push(row);
  });
  const table2EndRow = sheetRows.length - 1;

  // Khung chữ ký (nếu bật)
  let dateRowIdx = -1;
  let sigTitleRowIdx = -1;
  let sigSubRowIdx = -1;
  let sigNameRowIdx = -1;

  // Phân chia 3 băng cột đều nhau chuẩn theo hình ảnh mẫu:
  // Băng 1: GIÁO VIÊN BỘ MÔN (Trái)
  // Băng 2: GIÁO VIÊN CHỦ NHIỆM (Giữa)
  // Băng 3: BAN GIÁM HIỆU (Phải - có Ngày ..... tháng ..... năm 20.... căn giữa phía trên)
  const b1Start = 0;
  const b1End = Math.max(0, Math.floor(numColumns / 3) - 1);
  const b2Start = b1End + 1;
  const b2End = Math.max(b2Start, Math.floor((2 * numColumns) / 3) - 1);
  const b3Start = b2End + 1;
  const b3End = numColumns - 1;

  if (config.showSignatures) {
    sheetRows.push(new Array(numColumns).fill('')); // Blank separator

    dateRowIdx = sheetRows.length;
    const dateRow = new Array(numColumns).fill('');
    dateRow[b3Start] = config.customInfo?.signDate || `Ngày ..... tháng ..... năm 20....`;
    sheetRows.push(dateRow);

    sigTitleRowIdx = sheetRows.length;
    const sigTitleRow = new Array(numColumns).fill('');
    sigTitleRow[b1Start] = config.customInfo?.subjectTeacherTitle || `GIÁO VIÊN BỘ MÔN`;
    sigTitleRow[b2Start] = isOverall ? `TỔ TRƯỞNG CHUYÊN MÔN` : (config.customInfo?.homeroomTeacherTitle || `GIÁO VIÊN CHỦ NHIỆM`);
    sigTitleRow[b3Start] = config.customInfo?.headmasterTitle || `BAN GIÁM HIỆU`;
    sheetRows.push(sigTitleRow);

    sigSubRowIdx = sheetRows.length;
    const sigSubRow = new Array(numColumns).fill('');
    sigSubRow[b1Start] = `(Ký và ghi rõ họ tên)`;
    sigSubRow[b2Start] = `(Ký và ghi rõ họ tên)`;
    sigSubRow[b3Start] = `(Ký, đóng dấu)`;
    sheetRows.push(sigSubRow);

    sheetRows.push(new Array(numColumns).fill(''));
    sheetRows.push(new Array(numColumns).fill(''));
    sheetRows.push(new Array(numColumns).fill(''));

    sigNameRowIdx = sheetRows.length;
    const sigNameRow = new Array(numColumns).fill('');
    sigNameRow[b1Start] = config.customInfo?.subjectTeacherName || '';
    sigNameRow[b2Start] = isOverall 
      ? (config.customInfo?.homeroomTeacherName || '') 
      : (config.customInfo?.homeroomTeacherName || classSummary?.homeroomTeacher || '');
    sigNameRow[b3Start] = config.customInfo?.headmasterName || '';
    sheetRows.push(sigNameRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);

  // 4. Set Merges chính xác theo số cột được chọn (numColumns)
  const merges: XLSX.Range[] = [];

  // Merges chuẩn trang in cho Quốc hiệu, Tiêu ngữ và Cơ quan ban hành (Rows 0, 1, 2)
  if (leftEnd > leftStart) {
    merges.push({ s: { r: 0, c: leftStart }, e: { r: 0, c: leftEnd } });
    merges.push({ s: { r: 1, c: leftStart }, e: { r: 1, c: leftEnd } });
    merges.push({ s: { r: 2, c: leftStart }, e: { r: 2, c: leftEnd } });
  }
  if (rightEnd > rightStart) {
    merges.push({ s: { r: 0, c: rightStart }, e: { r: 0, c: rightEnd } });
    merges.push({ s: { r: 1, c: rightStart }, e: { r: 1, c: rightEnd } });
  }

  // Merges cho Tiêu đề chính, Kỳ thi, Banner GVCN & Sĩ số
  merges.push(
    { s: { r: 4, c: 0 }, e: { r: 4, c: numColumns - 1 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: numColumns - 1 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: numColumns - 1 } },
  );

  if (config.showSummaryTable && table1HeaderRowIndex !== -1) {
    merges.push({ s: { r: 8, c: 0 }, e: { r: 8, c: numColumns - 1 } });
  }

  merges.push({ s: { r: sec2RowIndex, c: 0 }, e: { r: sec2RowIndex, c: numColumns - 1 } });

  // Merges chuẩn cho khung 3 chữ ký ở cuối trang theo đúng hình mẫu
  if (config.showSignatures && dateRowIdx !== -1) {
    if (b3End > b3Start) {
      merges.push({ s: { r: dateRowIdx, c: b3Start }, e: { r: dateRowIdx, c: b3End } });
    }
    if (b1End > b1Start) {
      merges.push({ s: { r: sigTitleRowIdx, c: b1Start }, e: { r: sigTitleRowIdx, c: b1End } });
      merges.push({ s: { r: sigSubRowIdx, c: b1Start }, e: { r: sigSubRowIdx, c: b1End } });
      merges.push({ s: { r: sigNameRowIdx, c: b1Start }, e: { r: sigNameRowIdx, c: b1End } });
    }
    if (b2End > b2Start) {
      merges.push({ s: { r: sigTitleRowIdx, c: b2Start }, e: { r: sigTitleRowIdx, c: b2End } });
      merges.push({ s: { r: sigSubRowIdx, c: b2Start }, e: { r: sigSubRowIdx, c: b2End } });
      merges.push({ s: { r: sigNameRowIdx, c: b2Start }, e: { r: sigNameRowIdx, c: b2End } });
    }
    if (b3End > b3Start) {
      merges.push({ s: { r: sigTitleRowIdx, c: b3Start }, e: { r: sigTitleRowIdx, c: b3End } });
      merges.push({ s: { r: sigSubRowIdx, c: b3Start }, e: { r: sigSubRowIdx, c: b3End } });
      merges.push({ s: { r: sigNameRowIdx, c: b3Start }, e: { r: sigNameRowIdx, c: b3End } });
    }
  }

  ws['!merges'] = merges;

  // Cài đặt chiều cao dòng tối ưu, thoáng đãng chuẩn văn bản hành chính
  const rowHeights: any[] = [];
  rowHeights[0] = { hpt: 20 }; // Sở GD & Quốc hiệu
  rowHeights[1] = { hpt: 22 }; // Tên trường & Tiêu ngữ
  rowHeights[2] = { hpt: 18 }; // Đơn vị lưu trữ
  rowHeights[3] = { hpt: 8 };  // Spacer
  rowHeights[4] = { hpt: 26 }; // Tiêu đề chính BẢNG KẾT QUẢ...
  rowHeights[5] = { hpt: 19 }; // Kỳ thi & năm học
  rowHeights[6] = { hpt: 22 }; // Banner GVCN & Sĩ số
  rowHeights[7] = { hpt: 8 };  // Spacer

  const hasSigImages = Boolean(
    config.customInfo?.subjectTeacherSignatureImage ||
      config.customInfo?.homeroomTeacherSignatureImage ||
      config.customInfo?.headmasterSignatureImage
  );

  if (config.showSignatures && dateRowIdx !== -1) {
    rowHeights[dateRowIdx] = { hpt: 19 };
    rowHeights[sigTitleRowIdx] = { hpt: 22 };
    rowHeights[sigSubRowIdx] = { hpt: 18 };
    const blankSigRowH = hasSigImages ? 22 : 18;
    rowHeights[sigTitleRowIdx + 2] = { hpt: blankSigRowH };
    rowHeights[sigTitleRowIdx + 3] = { hpt: blankSigRowH };
    rowHeights[sigTitleRowIdx + 4] = { hpt: blankSigRowH };
    rowHeights[sigNameRowIdx] = { hpt: 22 };
  }
  ws['!rows'] = rowHeights;

  // 5. Styles for Header and Titles (Căn chỉnh chuẩn theo hình mẫu và quy chuẩn văn bản)
  // Row 0: SỞ GIÁO DỤC VÀ ĐÀO TẠO (Left) & CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM (Right)
  for (let c = leftStart; c <= leftEnd; c++) {
    applyCellStyle(ws, 0, c, {
      font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  for (let c = rightStart; c <= rightEnd; c++) {
    applyCellStyle(ws, 0, c, {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }

  // Row 1: TRƯỜNG: ... (Left, Bold) & Độc lập - Tự do - Hạnh phúc (Right, Italic)
  for (let c = leftStart; c <= leftEnd; c++) {
    applyCellStyle(ws, 1, c, {
      font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }
  for (let c = rightStart; c <= rightEnd; c++) {
    applyCellStyle(ws, 1, c, {
      font: { name: 'Times New Roman', sz: 10, italic: true, bold: false, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }

  // Row 2: Đơn vị lưu trữ hồ sơ khảo sát (Left, Italic)
  for (let c = leftStart; c <= leftEnd; c++) {
    applyCellStyle(ws, 2, c, {
      font: { name: 'Times New Roman', sz: 9, italic: true, color: { rgb: '64748B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }

  applyCellStyle(ws, 4, 0, { font: { name: 'Times New Roman', sz: 14, bold: true, color: { rgb: '0F172A' } }, alignment: { horizontal: 'center', vertical: 'center' } });
  applyCellStyle(ws, 5, 0, { font: { name: 'Times New Roman', sz: 10, italic: true, color: { rgb: '475569' } }, alignment: { horizontal: 'center', vertical: 'center' } });

  for (let c = 0; c < numColumns; c++) {
    applyCellStyle(ws, 6, c, {
      fill: FILL_BANNER,
      border: BORDER_THIN,
      font: { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  }

  if (config.showSummaryTable && table1HeaderRowIndex !== -1) {
    applyCellStyle(ws, 8, 0, { font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '0F172A' } }, alignment: { horizontal: 'left', vertical: 'center' } });

    // Style Table I Header
    const t1ColCount = Math.min(numColumns, table1Cols.length);
    for (let c = 0; c < t1ColCount; c++) {
      applyCellStyle(ws, table1HeaderRowIndex, c, {
        fill: FILL_HEADER,
        border: BORDER_THIN,
        font: { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: '111827' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      });
    }

    // Style Table I Data rows
    for (let r = table1StartRow; r <= table1EndRow; r++) {
      for (let c = 0; c < t1ColCount; c++) {
        const colDef = table1Cols[c];
        const isSubCol = c === 0;
        applyCellStyle(ws, r, c, {
          border: BORDER_THIN,
          font: {
            name: 'Times New Roman',
            sz: 9.5,
            bold: isSubCol || colDef?.isAvg || colDef?.isMax || colDef?.isDat || colDef?.isGioi,
            color: colDef?.isMax ? { rgb: '047857' } : { rgb: '111827' },
          },
          fill: colDef?.isAvg ? { patternType: 'solid', fgColor: { rgb: 'F0F4FF' } } : colDef?.isDat ? { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } } : colDef?.isGioi ? { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } } : undefined,
          alignment: { horizontal: isSubCol ? 'left' : 'center', vertical: 'center' },
        });
      }
    }
  }

  // Section II title
  applyCellStyle(ws, sec2RowIndex, 0, { font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '0F172A' } }, alignment: { horizontal: 'left', vertical: 'center' } });

  // Style Table II Header
  for (let c = 0; c < numColumns; c++) {
    const colDef = activeCols[c];
    let headerFill = FILL_HEADER;
    if (colDef?.isTotal) headerFill = FILL_TOTAL_HEADER;
    if (colDef?.isClassRank) headerFill = FILL_CLASS_RANK_HEADER;
    if (colDef?.isSchoolRank) headerFill = FILL_SCHOOL_RANK_HEADER;

    applyCellStyle(ws, table2HeaderRowIndex, c, {
      fill: headerFill,
      border: BORDER_THIN,
      font: { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: '111827' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    });
  }

  // Style Table II Student Data rows
  for (let r = table2StartRow; r <= table2EndRow; r++) {
    for (let c = 0; c < numColumns; c++) {
      const colDef = activeCols[c];
      let cellFill = undefined;
      let fontColor = { rgb: '111827' };
      let isBold = colDef?.key === 'sbd' || colDef?.key === 'name' || colDef?.isTotal || colDef?.isAvg || colDef?.isClassRank || colDef?.isSchoolRank;

      if (colDef?.isTotal) {
        cellFill = FILL_TOTAL_DATA;
        fontColor = { rgb: '1E3A8A' };
      } else if (colDef?.isClassRank) {
        cellFill = FILL_CLASS_RANK_DATA;
        fontColor = { rgb: '065F46' };
      } else if (colDef?.isSchoolRank) {
        cellFill = FILL_SCHOOL_RANK_DATA;
        fontColor = { rgb: '92400E' };
      }

      applyCellStyle(ws, r, c, {
        border: BORDER_THIN,
        fill: cellFill,
        font: {
          name: 'Times New Roman',
          sz: 9.5,
          bold: isBold,
          color: fontColor,
        },
        alignment: {
          horizontal: colDef?.align || 'center',
          vertical: 'center',
        },
      });
    }
  }

  // Style Signatures Block chuẩn theo hình ảnh mẫu image_6680639e.png
  if (config.showSignatures && dateRowIdx !== -1) {
    // 1. Ngày tháng căn giữa ngay phía trên BAN GIÁM HIỆU (Băng 3)
    for (let c = b3Start; c <= b3End; c++) {
      applyCellStyle(ws, dateRowIdx, c, {
        font: { name: 'Times New Roman', sz: 10, italic: true, color: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
    }

    // 2. Chức danh GIÁO VIÊN BỘ MÔN (Băng 1)
    for (let c = b1Start; c <= b1End; c++) {
      applyCellStyle(ws, sigTitleRowIdx, c, {
        font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
      applyCellStyle(ws, sigSubRowIdx, c, {
        font: { name: 'Times New Roman', sz: 9, italic: true, color: { rgb: '334155' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
      applyCellStyle(ws, sigNameRowIdx, c, {
        font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
    }

    // 3. Chức danh GIÁO VIÊN CHỦ NHIỆM / TỔ TRƯỞNG CHUYÊN MÔN (Băng 2)
    for (let c = b2Start; c <= b2End; c++) {
      applyCellStyle(ws, sigTitleRowIdx, c, {
        font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
      applyCellStyle(ws, sigSubRowIdx, c, {
        font: { name: 'Times New Roman', sz: 9, italic: true, color: { rgb: '334155' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
      applyCellStyle(ws, sigNameRowIdx, c, {
        font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
    }

    // 4. Chức danh BAN GIÁM HIỆU (Băng 3)
    for (let c = b3Start; c <= b3End; c++) {
      applyCellStyle(ws, sigTitleRowIdx, c, {
        font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
      applyCellStyle(ws, sigSubRowIdx, c, {
        font: { name: 'Times New Roman', sz: 9, italic: true, color: { rgb: '334155' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
      applyCellStyle(ws, sigNameRowIdx, c, {
        font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      });
    }
  }

  // Column width balancing
  const isLandscape = config.orientation === 'landscape';
  const targetTotalWidth = isLandscape ? 132 : 84;
  const scaleFactor = Math.max(0.75, Math.min(1.4, targetTotalWidth / (rawTotalWidth || 1)));

  const colWidths = activeCols.map((c) => ({
    wch: Math.max(5, Math.round(c.baseWidth * scaleFactor)),
  }));
  ws['!cols'] = colWidths;

  ws['!pageSetup'] = {
    orientation: config.orientation,
    paperSize: config.paperSize === 'a3' ? 8 : config.paperSize === 'letter' ? 1 : 9,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    verticalCentered: false,
  };

  ws['!margins'] = {
    left: 0.35,
    right: 0.35,
    top: 0.45,
    bottom: 0.45,
    header: 0.2,
    footer: 0.2,
  };

  if (!ws['!sheetPr']) ws['!sheetPr'] = {};
  ws['!sheetPr'].pageSetUpPr = { fitToPage: true };
  ws['!sheetViews'] = [{ showGridLines: true }];

  const safeSheetName = isOverall
    ? (options?.customSheetName || 'Tất cả các lớp')
    : cName.replace(/[\\/?*[\]]/g, '_').trim().substring(0, 31) || `Lop_${cName}`;

  return {
    ws,
    studentHeaderRowNumber,
    safeSheetName,
    activeCols,
    signaturePlacement: config.showSignatures && sigSubRowIdx !== -1
      ? {
          imgStartRow: sigSubRowIdx + 1,
          b1Start,
          b1End,
          b2Start,
          b2End,
          b3Start,
          b3End,
          colWidths: colWidths.map((cw) => cw.wch),
        }
      : null,
  };
}

/**
 * Xây dựng worksheet chi tiết cho một lớp học (tương thích ngược với cấu hình mặc định)
 */
export function buildClassWorksheet(session: StatisticSession, cName: string) {
  return buildCustomClassWorksheet(session, cName, createDefaultExportConfig(session, cName));
}

function parseDataUrlImage(dataUrl: string): { ext: 'png' | 'jpeg' | 'gif'; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i);
  if (!match) return null;
  const rawType = match[1].toLowerCase();
  const ext: 'png' | 'jpeg' | 'gif' = rawType === 'jpg' || rawType === 'jpeg' ? 'jpeg' : rawType === 'gif' ? 'gif' : 'png';
  const binaryStr = atob(match[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { ext, bytes };
}

function getBrowserImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || 160,
        height: img.naturalHeight || 70,
      });
    };
    img.onerror = () => resolve({ width: 160, height: 70 });
    img.src = dataUrl;
  });
}

function computeBandCenterAnchor(
  colWidths: number[],
  bandStart: number,
  bandEnd: number,
  imgWidthEmu: number
): { col: number; colOff: number } {
  const EMU_PER_WCH = 72000;
  let bandTotalEmu = 0;
  for (let c = bandStart; c <= bandEnd; c++) {
    bandTotalEmu += (colWidths[c] || 10) * EMU_PER_WCH;
  }
  let targetOffsetFromBandStart = Math.max(0, Math.round((bandTotalEmu - imgWidthEmu) / 2));
  let curCol = bandStart;
  while (curCol < bandEnd) {
    const colEmu = (colWidths[curCol] || 10) * EMU_PER_WCH;
    if (targetOffsetFromBandStart < colEmu) break;
    targetOffsetFromBandStart -= colEmu;
    curCol++;
  }
  return { col: curCol, colOff: Math.max(0, targetOffsetFromBandStart) };
}

/**
 * Xuất file Excel TÙY CHỈNH CHUẨN TRANG IN:
 * - Khi chọn xuất "Tất cả các lớp" hoặc "Các lớp được chọn":
 *   + SHEET ĐẦU TIÊN: Luôn là sheet "Tất cả các lớp" tổng hợp danh sách toàn bộ học sinh
 *   + CÁC SHEET TIẾP THEO: Tách riêng mỗi lớp một sheet và ĐẶT TÊN SHEET THEO LỚP (VD: 10A1, 10A2...)
 * - Tự động nhúng ảnh chữ ký và con dấu nhà trường (nếu người dùng có tải lên) trực tiếp vào khung chữ ký mỗi sheet
 */
export async function exportCustomExcel(session: StatisticSession, config: ExportPrintConfig) {
  const wb = XLSX.utils.book_new();
  const workbookMeta = ((wb as any).Workbook = (wb as any).Workbook || {});
  const workbookNames = (workbookMeta.Names = workbookMeta.Names || []);

  let currentSheetIndex = 0;
  const sheetPlacements: Array<{
    sheetNumber: number;
    placement: {
      imgStartRow: number;
      b1Start: number;
      b1End: number;
      b2Start: number;
      b2End: number;
      b3Start: number;
      b3End: number;
      colWidths: number[];
    } | null;
  }> = [];

  // 1. Xác định danh sách các lớp cần xuất
  let targetClasses: string[] = [];
  if (config.classScope === 'current') {
    targetClasses = config.selectedClasses.slice(0, 1);
  } else if (config.classScope === 'custom') {
    targetClasses = config.selectedClasses;
  } else {
    targetClasses = session.classes;
  }

  if (targetClasses.length === 0) {
    targetClasses = session.classes.slice(0, 1);
  }

  const isMultipleClasses = targetClasses.length > 1;

  // 2. KHI CHỌN XUẤT TẤT CẢ CÁC LỚP HOẶC CÁC LỚP ĐƯỢC CHỌN:
  // SHEET ĐẦU TIÊN LUÔN LÀ "Tất cả các lớp"
  if (isMultipleClasses) {
    const targetStudents = session.students
      .filter((s) => targetClasses.includes(s.className))
      .sort((a, b) => a.schoolRank - b.schoolRank);

    const overallSheetName = 'Tất cả các lớp';
    const { ws: wsOverall, studentHeaderRowNumber, signaturePlacement } = buildCustomClassWorksheet(
      session,
      'ALL',
      config,
      {
        isOverall: true,
        targetStudents,
        targetClassesCount: targetClasses.length,
        customTitle: targetClasses.length === session.classes.length
          ? 'BẢNG KẾT QUẢ ĐIỂM TỔNG HỢP - TOÀN TRƯỜNG'
          : `BẢNG KẾT QUẢ ĐIỂM TỔNG HỢP - ${targetClasses.length} LỚP ĐƯỢC CHỌN`,
        customSheetName: overallSheetName,
      }
    );

    if (config.repeatHeaderOnEveryPage) {
      workbookNames.push({
        Name: '_xlnm.Print_Titles',
        Ref: `'${overallSheetName}'!$${studentHeaderRowNumber}:$${studentHeaderRowNumber}`,
        Sheet: currentSheetIndex,
      });
    }

    XLSX.utils.book_append_sheet(wb, wsOverall, overallSheetName);
    currentSheetIndex++;
    sheetPlacements.push({ sheetNumber: currentSheetIndex, placement: signaturePlacement });
  }

  // 3. XUẤT RIÊNG MỖI LỚP MỘT SHEET VÀ ĐẶT TÊN SHEET THEO ĐÚNG TÊN LỚP
  targetClasses.forEach((cName) => {
    const { ws, studentHeaderRowNumber, safeSheetName, signaturePlacement } = buildCustomClassWorksheet(
      session,
      cName,
      config
    );

    // Đảm bảo tên sheet duy nhất không bị trùng lặp
    let uniqueSheetName = safeSheetName;
    if (wb.SheetNames.includes(uniqueSheetName)) {
      uniqueSheetName = `Lớp ${safeSheetName}`.substring(0, 31);
    }
    if (wb.SheetNames.includes(uniqueSheetName)) {
      uniqueSheetName = `${safeSheetName}_${currentSheetIndex}`.substring(0, 31);
    }

    if (config.repeatHeaderOnEveryPage) {
      workbookNames.push({
        Name: '_xlnm.Print_Titles',
        Ref: `'${uniqueSheetName}'!$${studentHeaderRowNumber}:$${studentHeaderRowNumber}`,
        Sheet: currentSheetIndex,
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName);
    currentSheetIndex++;
    sheetPlacements.push({ sheetNumber: currentSheetIndex, placement: signaturePlacement });
  });

  const suffix = targetClasses.length === 1
    ? `Lop_${targetClasses[0]}`
    : `TatCa_${targetClasses.length}Lop_CoSheetTongHop`;
  const safeFileName = `${session.name.replace(/[/\\?%*:|"<>]/g, '_')}_BaoCao_${suffix}_ChuanTrangIn.xlsx`;

  // Kiểm tra xem có ảnh chữ ký / con dấu nào cần nhúng vào Excel không
  const sigDefs = [
    { key: 'gvbm', band: 'b1' as const, dataUrl: config.customInfo?.subjectTeacherSignatureImage },
    { key: 'gvcn', band: 'b2' as const, dataUrl: config.customInfo?.homeroomTeacherSignatureImage },
    { key: 'bgh', band: 'b3' as const, dataUrl: config.customInfo?.headmasterSignatureImage },
  ];

  const activeImages: Array<{
    key: string;
    band: 'b1' | 'b2' | 'b3';
    ext: 'png' | 'jpeg' | 'gif';
    bytes: Uint8Array;
    cx: number;
    cy: number;
    fileName: string;
  }> = [];

  if (config.showSignatures) {
    for (const item of sigDefs) {
      if (!item.dataUrl) continue;
      const parsed = parseDataUrlImage(item.dataUrl);
      if (!parsed) continue;
      const dims = await getBrowserImageDimensions(item.dataUrl);
      const cy = 620000; // ~49pt height
      const cx = Math.min(1350000, Math.max(450000, Math.round(cy * (dims.width / Math.max(1, dims.height)))));
      activeImages.push({
        key: item.key,
        band: item.band,
        ext: parsed.ext,
        bytes: parsed.bytes,
        cx,
        cy,
        fileName: `sig_${item.key}.${parsed.ext}`,
      });
    }
  }

  if (activeImages.length === 0) {
    XLSX.writeFile(wb, safeFileName);
    return;
  }

  // Nhúng ảnh chữ ký & con dấu vào từng sheet trong file .xlsx bằng JSZip (OOXML DrawingML)
  try {
    const rawArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const zip = await JSZip.loadAsync(rawArray);

    // 1. Ghi file ảnh vào xl/media/
    for (const img of activeImages) {
      zip.file(`xl/media/${img.fileName}`, img.bytes);
    }

    let contentTypesXml = (await zip.file('[Content_Types].xml')?.async('string')) || '';

    // 2. Tạo drawing cho mỗi sheet có signaturePlacement
    for (const sp of sheetPlacements) {
      if (!sp.placement) continue;
      const sheetPath = `xl/worksheets/sheet${sp.sheetNumber}.xml`;
      const sheetFile = zip.file(sheetPath);
      if (!sheetFile) continue;

      let sheetXml = await sheetFile.async('string');
      const drawingFileName = `drawing${sp.sheetNumber}.xml`;

      // Tạo rels cho drawing
      const drawingRelsEntries = activeImages
        .map(
          (img, idx) =>
            `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${img.fileName}"/>`
        )
        .join('');
      const drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRelsEntries}</Relationships>`;
      zip.file(`xl/drawings/_rels/${drawingFileName}.rels`, drawingRelsXml);

      // Tạo drawing XML với oneCellAnchor giữ đúng tỷ lệ ảnh
      const anchorsXml = activeImages
        .map((img, idx) => {
          const bStart =
            img.band === 'b1' ? sp.placement!.b1Start : img.band === 'b2' ? sp.placement!.b2Start : sp.placement!.b3Start;
          const bEnd =
            img.band === 'b1' ? sp.placement!.b1End : img.band === 'b2' ? sp.placement!.b2End : sp.placement!.b3End;
          const { col, colOff } = computeBandCenterAnchor(sp.placement!.colWidths, bStart, bEnd, img.cx);
          const rowIdx = sp.placement!.imgStartRow;

          return `<xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${colOff}</xdr:colOff><xdr:row>${rowIdx}</xdr:row><xdr:rowOff>25000</xdr:rowOff></xdr:from><xdr:ext cx="${img.cx}" cy="${img.cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${idx + 2}" name="${img.fileName}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${idx + 1}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.cx}" cy="${img.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
        })
        .join('');

      const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchorsXml}</xdr:wsDr>`;
      zip.file(`xl/drawings/${drawingFileName}`, drawingXml);

      // Liên kết drawing với sheet
      const sheetRelsPath = `xl/worksheets/_rels/sheet${sp.sheetNumber}.xml.rels`;
      const existingRels = await zip.file(sheetRelsPath)?.async('string');
      const drawingRelTag = `<Relationship Id="rIdDrawing1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${drawingFileName}"/>`;
      if (existingRels && existingRels.includes('</Relationships>')) {
        zip.file(sheetRelsPath, existingRels.replace('</Relationships>', `${drawingRelTag}</Relationships>`));
      } else {
        zip.file(
          sheetRelsPath,
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRelTag}</Relationships>`
        );
      }

      // Thêm tag <drawing r:id="rIdDrawing1"/> vào worksheet XML
      if (sheetXml.includes('<extLst')) {
        sheetXml = sheetXml.replace('<extLst', `<drawing r:id="rIdDrawing1"/><extLst`);
      } else {
        sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="rIdDrawing1"/></worksheet>`);
      }
      zip.file(sheetPath, sheetXml);

      // Đăng ký Content Type cho drawing
      if (contentTypesXml && !contentTypesXml.includes(`/xl/drawings/${drawingFileName}`)) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          `<Override PartName="/xl/drawings/${drawingFileName}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
        );
      }
    }

    if (contentTypesXml) {
      zip.file('[Content_Types].xml', contentTypesXml);
    }

    const outBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(outBlob, safeFileName);
  } catch (err) {
    console.warn('Không thể nhúng ảnh vào file Excel, xuất file Excel tiêu chuẩn:', err);
    XLSX.writeFile(wb, safeFileName);
  }
}

/**
 * Xuất file Excel ĐA SHEET (Tất cả các lớp - mặc định)
 */
export function exportMultiSheetWorkbook(session: StatisticSession) {
  exportCustomExcel(session, createDefaultExportConfig(session));
}

/**
 * Xuất file Excel CHO RIÊNG MỘT LỚP ĐƯỢC CHỌN (mặc định)
 */
export function exportSingleClassWorkbook(session: StatisticSession, className: string) {
  const config = createDefaultExportConfig(session, className);
  config.classScope = 'current';
  config.selectedClasses = [className];
  exportCustomExcel(session, config);
}

/**
 * Xuất bảng thống kê tiêu chuẩn độc lập
 */
export function exportStandardReportExcel(session: StatisticSession) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Thống kê toàn trường
  const schoolRows: any[][] = [
    [`BẢNG THỐNG KÊ KẾT QUẢ ĐIỂM THEO TIÊU CHUẨN`],
    [`Đơn vị: ${session.schoolName} | Đợt: ${session.name} | Năm học: ${session.academicYear}`],
    [],
    [
      'Môn học',
      'Số bài thi',
      'Điểm TB',
      'Điểm Max',
      'Điểm Min',
      ...session.intervals.map((inv) => inv.label),
      'Đạt (>=5.0)',
      'Tỉ lệ đạt %',
      'Giỏi (>=8.0)',
      'Tỉ lệ giỏi %',
    ],
  ];

  session.subjects.forEach((sub) => {
    const s = session.overallStats[sub];
    if (!s) return;
    schoolRows.push([
      sub,
      s.count,
      s.avgScore,
      s.maxScore,
      s.minScore,
      ...session.intervals.map((inv) => `${s.intervalCounts[inv.id] || 0} (${s.intervalPercents[inv.id] || 0}%)`),
      s.above5Count,
      `${s.above5Percent}%`,
      s.above8Count,
      `${s.above8Percent}%`,
    ]);
  });

  const wsSchool = XLSX.utils.aoa_to_sheet(schoolRows);
  XLSX.utils.book_append_sheet(wb, wsSchool, 'ThongKe_ToanTruong');

  // Sheet 2: Thống kê theo từng lớp
  const classStatRows: any[][] = [
    [`BẢNG THỐNG KÊ THEO TỪNG LỚP`],
    [],
    [
      'Lớp',
      'Khối',
      'GV Chủ nhiệm',
      'Môn học',
      'Số bài',
      'Điểm TB',
      'Max',
      'Min',
      ...session.intervals.map((inv) => inv.label),
      'Đạt (>=5)',
      '% Đạt',
      'Giỏi (>=8)',
      '% Giỏi',
    ],
  ];

  session.classes.forEach((cName) => {
    const cs = session.classSummaries[cName];
    if (!cs) return;

    session.subjects.forEach((sub) => {
      const s = cs.subjectStats[sub];
      if (!s) return;
      classStatRows.push([
        cName,
        cs.grade,
        cs.homeroomTeacher,
        sub,
        s.count,
        s.avgScore,
        s.maxScore,
        s.minScore,
        ...session.intervals.map((inv) => `${s.intervalCounts[inv.id] || 0} (${s.intervalPercents[inv.id] || 0}%)`),
        s.above5Count,
        `${s.above5Percent}%`,
        s.above8Count,
        `${s.above8Percent}%`,
      ]);
    });
  });

  const wsClass = XLSX.utils.aoa_to_sheet(classStatRows);
  XLSX.utils.book_append_sheet(wb, wsClass, 'ThongKe_TheoLop');

  const safeFileName = `${session.name.replace(/[/\\?%*:|"<>]/g, '_')}_BangThongKe_TieuChuan.xlsx`;
  XLSX.writeFile(wb, safeFileName);
}

/**
 * Xuất file Excel chuyên dụng: Bảng thống kê so sánh Điểm trung bình từng môn của từng lớp so với trường
 * (Chỉ rõ cao hơn hay thấp hơn bao nhiêu điểm)
 */
export function exportSubjectComparisonExcel(session: StatisticSession) {
  const wb = XLSX.utils.book_new();

  // Tính Điểm TB Tổng cộng của trường
  const schoolTotalAvg = session.students.length > 0
    ? Math.round((session.students.reduce((acc, s) => acc + s.averageScore, 0) / session.students.length) * 100) / 100
    : 0;

  // Header 1 và Header 2 cho bảng ma trận
  const headerRow1: string[] = ['STT', 'Lớp', 'Khối', 'Sĩ số', 'GV Chủ Nhiệm'];
  const headerRow2: string[] = ['', '', '', '', ''];

  session.subjects.forEach((sub) => {
    headerRow1.push(sub, '');
    headerRow2.push('Điểm TB', 'So với Trường (±)');
  });

  headerRow1.push('Tổng hợp', '');
  headerRow2.push('ĐTB Chung', 'Đánh giá');

  const rows: any[][] = [
    ['BẢNG THỐNG KÊ SO SÁNH ĐIỂM TRUNG BÌNH TỪNG MÔN THEO LỚP SO VỚI TRƯỜNG'],
    [`Đơn vị: ${session.schoolName} | Đợt khảo sát: ${session.name} | Năm học: ${session.academicYear}`],
    ['Ghi chú: So sánh điểm TB từng môn của từng lớp với điểm TB tương ứng của toàn trường (Cao hơn (+) hay thấp hơn (-) bao nhiêu điểm)'],
    [],
    headerRow1,
    headerRow2,
  ];

  // Hàng dữ liệu từng lớp
  session.classes.forEach((cName, idx) => {
    const cs = session.classSummaries[cName];
    const cStudents = session.students.filter((s) => s.className === cName);
    const cAvgScore = cStudents.length > 0
      ? Math.round((cStudents.reduce((acc, s) => acc + s.averageScore, 0) / cStudents.length) * 100) / 100
      : 0;

    let aboveCount = 0;
    let belowCount = 0;

    const rowData: any[] = [
      idx + 1,
      `Lớp ${cName}`,
      cs?.grade || '',
      cs?.studentCount || cStudents.length,
      cs?.homeroomTeacher || '',
    ];

    session.subjects.forEach((sub) => {
      const classSubStat = cs?.subjectStats[sub];
      const schoolSubStat = session.overallStats[sub];

      if (!classSubStat || !schoolSubStat) {
        rowData.push('-', '-');
        return;
      }

      const cScore = classSubStat.avgScore;
      const sScore = schoolSubStat.avgScore;
      const diff = Math.round((cScore - sScore) * 100) / 100;

      if (diff > 0) aboveCount++;
      else if (diff < 0) belowCount++;

      rowData.push(cScore.toFixed(2));
      const diffStr = diff > 0
        ? `+${diff.toFixed(2)} (Cao hơn)`
        : diff < 0
        ? `${diff.toFixed(2)} (Thấp hơn)`
        : `0.00 (Bằng trường)`;
      rowData.push(diffStr);
    });

    const diffTotal = Math.round((cAvgScore - schoolTotalAvg) * 100) / 100;
    rowData.push(cAvgScore.toFixed(2));
    rowData.push(`${aboveCount}/${session.subjects.length} môn cao hơn trường (${diffTotal >= 0 ? '+' : ''}${diffTotal.toFixed(2)})`);

    rows.push(rowData);
  });

  // Hàng mốc chuẩn toàn trường
  const schoolRow: any[] = [
    '',
    'TOÀN TRƯỜNG (MỐC CHUẨN)',
    'Tất cả',
    session.students.length,
    'Trường',
  ];

  session.subjects.forEach((sub) => {
    const sStat = session.overallStats[sub];
    schoolRow.push(sStat ? sStat.avgScore.toFixed(2) : '-');
    schoolRow.push('MỐC CHUẨN (0.00)');
  });

  schoolRow.push(schoolTotalAvg.toFixed(2), 'Điểm chuẩn toàn trường');
  rows.push([]);
  rows.push(schoolRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Gộp ô tiêu đề
  const totalCols = 5 + session.subjects.length * 2 + 2;
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } },
    // Gộp STT, Lớp, Khối, Sĩ số, GVCN hàng 4 và 5
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
    { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } },
    { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } },
    { s: { r: 4, c: 4 }, e: { r: 5, c: 4 } },
  ];

  // Gộp tiêu đề cho từng môn học
  let colPointer = 5;
  session.subjects.forEach(() => {
    merges.push({ s: { r: 4, c: colPointer }, e: { r: 4, c: colPointer + 1 } });
    colPointer += 2;
  });
  merges.push({ s: { r: 4, c: colPointer }, e: { r: 4, c: colPointer + 1 } });

  ws['!merges'] = merges;

  // Định dạng độ rộng cột
  const colsWidth: Array<{ wch: number }> = [
    { wch: 6 },  // STT
    { wch: 12 }, // Lớp
    { wch: 8 },  // Khối
    { wch: 8 },  // Sĩ số
    { wch: 22 }, // GVCN
  ];

  session.subjects.forEach(() => {
    colsWidth.push({ wch: 10 }); // Điểm TB
    colsWidth.push({ wch: 18 }); // Lệch trường
  });

  colsWidth.push({ wch: 12 }); // ĐTB Chung
  colsWidth.push({ wch: 26 }); // Đánh giá

  ws['!cols'] = colsWidth;

  // Áp dụng định dạng in ấn & kẻ viền
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToWidth: 1,
    fitToHeight: 0,
  };
  ws['!margins'] = { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  if (!ws['!sheetPr']) ws['!sheetPr'] = {};
  ws['!sheetPr'].pageSetUpPr = { fitToPage: true };
  ws['!sheetViews'] = [{ showGridLines: true }];

  // Áp dụng style cho các ô tiêu đề và dữ liệu
  const titleStyle = {
    font: { name: 'Times New Roman', sz: 14, bold: true, color: { rgb: '1E1B4B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };
  const subTitleStyle = {
    font: { name: 'Times New Roman', sz: 10, italic: true, color: { rgb: '4B5563' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  applyCellStyle(ws, 0, 0, titleStyle);
  applyCellStyle(ws, 1, 0, subTitleStyle);
  applyCellStyle(ws, 2, 0, subTitleStyle);

  // Style Header hàng 4 và 5
  for (let r = 4; r <= 5; r++) {
    for (let c = 0; c < totalCols; c++) {
      applyCellStyle(ws, r, c, {
        font: { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: '111827' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: BORDER_THIN,
      });
    }
  }

  // Style các ô dữ liệu
  const startDataRow = 6;
  const numDataRows = session.classes.length;

  for (let r = startDataRow; r < startDataRow + numDataRows; r++) {
    const classIdx = r - startDataRow;
    const cName = session.classes[classIdx];
    const cs = session.classSummaries[cName];

    for (let c = 0; c < totalCols; c++) {
      const cellStyle: any = {
        font: { name: 'Times New Roman', sz: 9.5 },
        border: BORDER_THIN,
        alignment: { vertical: 'center' },
      };

      if (c === 0 || c === 2 || c === 3) {
        cellStyle.alignment.horizontal = 'center';
      } else if (c === 1 || c === 4) {
        cellStyle.alignment.horizontal = 'left';
        if (c === 1) cellStyle.font.bold = true;
      } else {
        // Cột điểm và cột chênh lệch
        cellStyle.alignment.horizontal = 'center';

        // Kiểm tra xem có phải cột "So với Trường" không
        // Cột so với trường có chỉ số c = 6, 8, 10...
        const subIndex = Math.floor((c - 5) / 2);
        const isDiffCol = (c - 5) % 2 === 1;

        if (c >= 5 && c < 5 + session.subjects.length * 2) {
          const sub = session.subjects[subIndex];
          const classSubStat = cs?.subjectStats[sub];
          const schoolSubStat = session.overallStats[sub];

          if (classSubStat && schoolSubStat) {
            const diff = classSubStat.avgScore - schoolSubStat.avgScore;
            if (isDiffCol) {
              if (diff > 0.05) {
                cellStyle.font = { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: '047857' } };
                cellStyle.fill = { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } };
              } else if (diff < -0.05) {
                cellStyle.font = { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: 'B91C1C' } };
                cellStyle.fill = { patternType: 'solid', fgColor: { rgb: 'FEF2F2' } };
              } else {
                cellStyle.font = { name: 'Times New Roman', sz: 9.5, color: { rgb: '4B5563' } };
              }
            } else {
              cellStyle.font.bold = true;
            }
          }
        }
      }

      applyCellStyle(ws, r, c, cellStyle);
    }
  }

  // Style hàng Mốc Chuẩn Toàn Trường (Hàng cuối)
  const schoolRowIdx = startDataRow + numDataRows + 1;
  for (let c = 0; c < totalCols; c++) {
    applyCellStyle(ws, schoolRowIdx, c, {
      font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '1E1B4B' } },
      alignment: { horizontal: c === 1 ? 'left' : 'center', vertical: 'center' },
      border: BORDER_THIN,
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, 'SoSanh_Lop_vs_Truong');

  const safeFileName = `${session.name.replace(/[/\\?%*:|"<>]/g, '_')}_SoSanh_DiemTB_Lop_vs_Truong.xlsx`;
  XLSX.writeFile(wb, safeFileName);
}

/**
 * Xuất danh sách học sinh Thủ Khoa theo các Khối toàn trường ra tệp Excel
 */
export function exportGradeValedictoriansExcel(session: StatisticSession) {
  const wb = XLSX.utils.book_new();

  // Tìm danh sách khối và học sinh thủ khoa từng khối
  const distinctGrades = (session.grades && session.grades.length > 0)
    ? session.grades
    : Array.from(new Set(session.students.map((s) => s.grade || 'Khối chung'))).sort();

  const gradeTopStudents: Array<{ grade: string; student: Student; studentCount: number; classCount: number }> = [];

  distinctGrades.forEach((g) => {
    const gStudents = session.students.filter((s) => (s.grade || 'Khối chung') === g);
    if (gStudents.length === 0) return;
    const top = [...gStudents].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.averageScore - a.averageScore;
    })[0];
    const classesInGrade = Array.from(new Set(gStudents.map((s) => s.className)));
    if (top) {
      gradeTopStudents.push({
        grade: g,
        student: top,
        studentCount: gStudents.length,
        classCount: classesInGrade.length,
      });
    }
  });

  const hasPhach = gradeTopStudents.some((item) => item.student.soPhach);
  const subjects = session.subjects;

  // Xây dựng danh sách cột
  const headers = ['STT', 'Khối', 'Họ và tên', 'SBD'];
  if (hasPhach) headers.push('Số phách');
  headers.push('Lớp');
  subjects.forEach((sub) => headers.push(sub));
  headers.push('Tổng điểm', 'Điểm TB', 'Hạng toàn trường');

  const totalCols = headers.length;
  const midCol = Math.floor(totalCols / 2);

  // Banner Quốc hiệu & Tên trường
  const r0 = new Array(totalCols).fill('');
  r0[0] = 'SỞ GIÁO DỤC VÀ ĐÀO TẠO';
  r0[midCol] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';

  const r1 = new Array(totalCols).fill('');
  r1[0] = (session.schoolName || 'TRƯỜNG THCS THƯ VŨ').toUpperCase();
  r1[midCol] = 'Độc lập - Tự do - Hạnh phúc';

  const r2: string[] = [];
  const r3 = ['DANH SÁCH HỌC SINH THỦ KHOA THEO CÁC KHỐI TOÀN TRƯỜNG'];
  const r4 = [`Kỳ kiểm tra: ${session.name} | Năm học: ${session.academicYear} | Đơn vị: ${session.schoolName}`];
  const r5: string[] = [];

  const dataRows: any[][] = gradeTopStudents.map((item, idx) => {
    const s = item.student;
    const row: any[] = [
      idx + 1,
      item.grade,
      s.name,
      s.sbd || '-',
    ];
    if (hasPhach) row.push(s.soPhach || '-');
    row.push(s.className);
    subjects.forEach((sub) => {
      const sc = s.scores[sub];
      row.push(typeof sc === 'number' ? sc.toFixed(1) : '-');
    });
    row.push(s.totalScore.toFixed(2), s.averageScore.toFixed(2), `#${s.schoolRank}`);
    return row;
  });

  const wsData = [r0, r1, r2, r3, r4, r5, headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: midCol - 1 } },
    { s: { r: 0, c: midCol }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: midCol - 1 } },
    { s: { r: 1, c: midCol }, e: { r: 1, c: totalCols - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } },
  ];
  ws['!merges'] = merges;

  // Column widths
  const colsWidth = [
    { wch: 6 },  // STT
    { wch: 12 }, // Khối
    { wch: 25 }, // Họ tên
    { wch: 14 }, // SBD
  ];
  if (hasPhach) colsWidth.push({ wch: 12 });
  colsWidth.push({ wch: 10 }); // Lớp
  subjects.forEach(() => colsWidth.push({ wch: 10 }));
  colsWidth.push({ wch: 12 }, { wch: 10 }, { wch: 16 });
  ws['!cols'] = colsWidth;

  // Styles
  const borderThin = {
    top: { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
    left: { style: 'thin', color: { rgb: 'D1D5DB' } },
    right: { style: 'thin', color: { rgb: 'D1D5DB' } },
  };

  applyCellStyle(ws, 0, 0, { font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '374151' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 0, midCol, { font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '111827' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 1, 0, { font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 1, midCol, { font: { name: 'Times New Roman', sz: 10, italic: true, bold: true }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 3, 0, { font: { name: 'Times New Roman', sz: 14, bold: true, color: { rgb: 'B45309' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 4, 0, { font: { name: 'Times New Roman', sz: 10, italic: true, color: { rgb: '4B5563' } }, alignment: { horizontal: 'center' } });

  // Header row (row 6)
  for (let c = 0; c < totalCols; c++) {
    applyCellStyle(ws, 6, c, {
      font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    });
  }

  // Data rows
  for (let r = 0; r < dataRows.length; r++) {
    const rowIdx = 7 + r;
    const isEven = r % 2 === 0;
    for (let c = 0; c < totalCols; c++) {
      const isName = c === 2;
      applyCellStyle(ws, rowIdx, c, {
        font: { name: 'Times New Roman', sz: 10, bold: isName || c === totalCols - 3 },
        fill: { patternType: 'solid', fgColor: { rgb: isEven ? 'FFFFFF' : 'F9FAFB' } },
        border: borderThin,
        alignment: { horizontal: isName ? 'left' : 'center', vertical: 'center' },
      });
    }
  }

  ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };
  ws['!margins'] = { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  if (!ws['!sheetPr']) ws['!sheetPr'] = {};
  ws['!sheetPr'].pageSetUpPr = { fitToPage: true };
  ws['!sheetViews'] = [{ showGridLines: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'Thu_Khoa_Cac_Khoi');
  const safeFileName = `${session.name.replace(/[/\\?%*:|"<>]/g, '_')}_Thu_Khoa_Theo_Khoi.xlsx`;
  XLSX.writeFile(wb, safeFileName);
}

/**
 * Xuất danh sách học sinh Thủ Khoa theo các Lớp toàn trường ra tệp Excel
 */
export function exportClassValedictoriansExcel(session: StatisticSession, gradeFilter?: string) {
  const wb = XLSX.utils.book_new();

  const isSpecificGrade = gradeFilter && gradeFilter !== 'ALL';
  const targetClasses = isSpecificGrade
    ? session.classes.filter((c) => session.classSummaries[c]?.grade === gradeFilter)
    : session.classes;

  const classTopStudents: Array<{ className: string; grade: string; student: Student; studentCount: number }> = [];

  targetClasses.forEach((c) => {
    const cStudents = session.students.filter((s) => s.className === c);
    if (cStudents.length === 0) return;
    const top = [...cStudents].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.averageScore - a.averageScore;
    })[0];
    if (top) {
      classTopStudents.push({
        className: c,
        grade: session.classSummaries[c]?.grade || '',
        student: top,
        studentCount: cStudents.length,
      });
    }
  });

  const hasPhach = classTopStudents.some((item) => item.student.soPhach);
  const subjects = session.subjects;

  // Xây dựng danh sách cột
  const headers = ['STT', 'Lớp', 'Khối', 'Họ và tên', 'SBD'];
  if (hasPhach) headers.push('Số phách');
  subjects.forEach((sub) => headers.push(sub));
  headers.push('Tổng điểm', 'Điểm TB', 'Hạng toàn trường');

  const totalCols = headers.length;
  const midCol = Math.floor(totalCols / 2);

  // Banner Quốc hiệu & Tên trường
  const r0 = new Array(totalCols).fill('');
  r0[0] = 'SỞ GIÁO DỤC VÀ ĐÀO TẠO';
  r0[midCol] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';

  const r1 = new Array(totalCols).fill('');
  r1[0] = (session.schoolName || 'TRƯỜNG THCS THƯ VŨ').toUpperCase();
  r1[midCol] = 'Độc lập - Tự do - Hạnh phúc';

  const r2: string[] = [];
  const r3 = [
    isSpecificGrade
      ? `DANH SÁCH HỌC SINH THỦ KHOA CÁC LỚP THUỘC ${gradeFilter.toUpperCase()}`
      : 'DANH SÁCH HỌC SINH THỦ KHOA THEO CÁC LỚP TOÀN TRƯỜNG',
  ];
  const r4 = [`Kỳ kiểm tra: ${session.name} | Năm học: ${session.academicYear} | Đơn vị: ${session.schoolName}`];
  const r5: string[] = [];

  const dataRows: any[][] = classTopStudents.map((item, idx) => {
    const s = item.student;
    const row: any[] = [
      idx + 1,
      item.className,
      item.grade || '-',
      s.name,
      s.sbd || '-',
    ];
    if (hasPhach) row.push(s.soPhach || '-');
    subjects.forEach((sub) => {
      const sc = s.scores[sub];
      row.push(typeof sc === 'number' ? sc.toFixed(1) : '-');
    });
    row.push(s.totalScore.toFixed(2), s.averageScore.toFixed(2), `#${s.schoolRank}`);
    return row;
  });

  const wsData = [r0, r1, r2, r3, r4, r5, headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: midCol - 1 } },
    { s: { r: 0, c: midCol }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: midCol - 1 } },
    { s: { r: 1, c: midCol }, e: { r: 1, c: totalCols - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } },
  ];
  ws['!merges'] = merges;

  // Column widths
  const colsWidth = [
    { wch: 6 },  // STT
    { wch: 10 }, // Lớp
    { wch: 10 }, // Khối
    { wch: 25 }, // Họ tên
    { wch: 14 }, // SBD
  ];
  if (hasPhach) colsWidth.push({ wch: 12 });
  subjects.forEach(() => colsWidth.push({ wch: 10 }));
  colsWidth.push({ wch: 12 }, { wch: 10 }, { wch: 16 });
  ws['!cols'] = colsWidth;

  const borderThin = {
    top: { style: 'thin', color: { rgb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
    left: { style: 'thin', color: { rgb: 'D1D5DB' } },
    right: { style: 'thin', color: { rgb: 'D1D5DB' } },
  };

  applyCellStyle(ws, 0, 0, { font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '374151' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 0, midCol, { font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: '111827' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 1, 0, { font: { name: 'Times New Roman', sz: 11, bold: true, color: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 1, midCol, { font: { name: 'Times New Roman', sz: 10, italic: true, bold: true }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 3, 0, { font: { name: 'Times New Roman', sz: 14, bold: true, color: { rgb: '047857' } }, alignment: { horizontal: 'center' } });
  applyCellStyle(ws, 4, 0, { font: { name: 'Times New Roman', sz: 10, italic: true, color: { rgb: '4B5563' } }, alignment: { horizontal: 'center' } });

  // Header row (row 6)
  for (let c = 0; c < totalCols; c++) {
    applyCellStyle(ws, 6, c, {
      font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '065F46' } },
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    });
  }

  // Data rows
  for (let r = 0; r < dataRows.length; r++) {
    const rowIdx = 7 + r;
    const isEven = r % 2 === 0;
    for (let c = 0; c < totalCols; c++) {
      const isName = c === 3;
      applyCellStyle(ws, rowIdx, c, {
        font: { name: 'Times New Roman', sz: 10, bold: isName || c === totalCols - 3 },
        fill: { patternType: 'solid', fgColor: { rgb: isEven ? 'FFFFFF' : 'F9FAFB' } },
        border: borderThin,
        alignment: { horizontal: isName ? 'left' : 'center', vertical: 'center' },
      });
    }
  }

  ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true };
  ws['!margins'] = { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
  if (!ws['!sheetPr']) ws['!sheetPr'] = {};
  ws['!sheetPr'].pageSetUpPr = { fitToPage: true };
  ws['!sheetViews'] = [{ showGridLines: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'Thu_Khoa_Cac_Lop');
  const safeFileName = `${session.name.replace(/[/\\?%*:|"<>]/g, '_')}_Thu_Khoa_Theo_Lop.xlsx`;
  XLSX.writeFile(wb, safeFileName);
}




