export interface Student {
  id: string;
  stt: number;
  sbd: string;
  soPhach?: string; // Số phách / Mã phách
  name: string;
  dob?: string;
  gender?: string;
  school?: string;
  grade?: string; // Khối 10, 11, 12, 9...
  className: string; // Lớp 9D1, 10A1, 10A2...
  examRoom?: string; // Phòng thi (VD: 901, P.01...)
  scores: Record<string, number | null>; // subjectKey -> score (0-10 or null)
  totalScore: number;
  averageScore: number;
  schoolRank: number;
  classRank: number;
  notes?: string;
}

export interface ScoreInterval {
  id: string;
  label: string; // e.g. "Dưới 1.0", "Từ 1.0 đến < 2.0", "9.0 - 10.0"
  min: number;   // inclusive
  max: number;   // exclusive (except for max=10 where inclusive)
  color?: string;
}

export interface SubjectStats {
  subjectName: string;
  count: number;
  maxScore: number;
  minScore: number;
  avgScore: number;
  intervalCounts: Record<string, number>; // intervalId -> count
  intervalPercents: Record<string, number>; // intervalId -> percentage
  above5Count: number;
  above5Percent: number;
  above8Count: number;
  above8Percent: number;
}

export interface ClassSummary {
  className: string;
  grade: string;
  homeroomTeacher: string;
  subjectTeachers?: Record<string, string>;
  studentCount: number;
  avgTotalScore: number;
  subjectStats: Record<string, SubjectStats>; // subjectName -> SubjectStats
}

export interface StatisticSession {
  id: string;
  name: string; // Tên lần thống kê (VD: "Khảo sát chất lượng Giữa Kỳ 1 - 2025-2026")
  createdAt: number;
  schoolName: string;
  academicYear: string;
  fileName: string;
  fileSize: number;
  subjects: string[]; // Danh sách các môn thi phát hiện được
  classes: string[];  // Danh sách các lớp
  grades: string[];   // Danh sách các khối
  intervals: ScoreInterval[];
  students: Student[];
  classSummaries: Record<string, ClassSummary>;
  overallStats: Record<string, SubjectStats>; // Thống kê toàn trường theo môn
}

export type StatPreset = 'standard_10' | 'moet_ranking' | 'pass_fail' | 'custom';

export interface ExportPrintConfig {
  // 1. Lựa chọn lớp cần xuất
  classScope: 'current' | 'all' | 'custom';
  selectedClasses: string[]; // Danh sách các lớp được chọn
  includeOverallSummary: boolean; // Kèm sheet Tổng hợp toàn trường
  includeOverallStats: boolean; // Kèm sheet Thống kê tiêu chuẩn toàn trường

  // 2. Lựa chọn các cột học sinh (Bảng II)
  columns: {
    stt: boolean;
    sbd: boolean;
    name: boolean;
    dob: boolean;
    examRoom: boolean;
    gender: boolean;
    className: boolean;
    grade: boolean;
    subjects: Record<string, boolean>; // subjectName -> boolean
    totalScore: boolean;
    averageScore: boolean;
    classRank: boolean;
    schoolRank: boolean;
    notes: boolean;
  };

  // 3. Hướng giấy in & khổ giấy
  orientation: 'landscape' | 'portrait';
  paperSize: 'a4' | 'a3' | 'letter';
  scalePercent: number; // 65 - 100%

  // 4. Tiêu chuẩn thống kê cần in (Bảng I)
  showSummaryTable: boolean; // Bật/tắt Bảng I
  summaryCriteria: {
    count: boolean; // Số bài thi
    avgScore: boolean; // Điểm TB
    maxScore: boolean; // Max
    minScore: boolean; // Min
    intervals: Record<string, boolean>; // intervalId -> boolean
    above5: boolean; // Đạt (>=5) & % Đạt
    above8: boolean; // Giỏi (>=8) & % Giỏi
  };

  // 5. Khung chữ ký và nâng cao
  showSignatures: boolean;
  repeatHeaderOnEveryPage: boolean;

  // 6. Tùy chỉnh thông tin tiêu đề, tiêu ngữ & chữ ký hình ảnh
  customInfo?: ReportCustomInfo;
}

export interface ReportCustomInfo {
  departmentName: string;
  schoolName: string;
  documentSubTitle: string;
  mottoTitle: string;
  mottoSubTitle: string;
  signDate: string;
  
  // Giáo viên bộ môn
  subjectTeacherTitle: string;
  subjectTeacherName: string;
  subjectTeacherSignatureImage?: string;

  // Giáo viên chủ nhiệm
  homeroomTeacherTitle: string;
  homeroomTeacherName: string;
  homeroomTeacherSignatureImage?: string;

  // Ban giám hiệu
  headmasterTitle: string;
  headmasterName: string;
  headmasterSignatureImage?: string;
}

export function createDefaultExportConfig(session: StatisticSession, initialClass?: string): ExportPrintConfig {
  const hasRooms = session.students.some((s) => s.examRoom);
  
  const subjectsMap: Record<string, boolean> = {};
  session.subjects.forEach((sub) => {
    subjectsMap[sub] = true;
  });

  const intervalsMap: Record<string, boolean> = {};
  session.intervals.forEach((inv) => {
    intervalsMap[inv.id] = true;
  });

  return {
    classScope: initialClass ? 'current' : 'all',
    selectedClasses: initialClass ? [initialClass] : [...session.classes],
    includeOverallSummary: true,
    includeOverallStats: true,
    columns: {
      stt: true,
      sbd: true,
      name: true,
      dob: true,
      examRoom: hasRooms,
      gender: true,
      className: false,
      grade: false,
      subjects: subjectsMap,
      totalScore: true,
      averageScore: true,
      classRank: true,
      schoolRank: true,
      notes: false,
    },
    orientation: 'landscape',
    paperSize: 'a4',
    scalePercent: 85,
    showSummaryTable: true,
    summaryCriteria: {
      count: true,
      avgScore: true,
      maxScore: true,
      minScore: true,
      intervals: intervalsMap,
      above5: true,
      above8: true,
    },
    showSignatures: true,
    repeatHeaderOnEveryPage: true,
    customInfo: {
      departmentName: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
      schoolName: session.schoolName || 'TRƯỜNG THCS THƯ VŨ',
      documentSubTitle: 'Đơn vị lưu trữ hồ sơ khảo sát',
      mottoTitle: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
      mottoSubTitle: 'Độc lập - Tự do - Hạnh phúc',
      signDate: 'Ngày ..... tháng ..... năm 20....',
      subjectTeacherTitle: 'GIÁO VIÊN BỘ MÔN',
      subjectTeacherName: '',
      subjectTeacherSignatureImage: undefined,
      homeroomTeacherTitle: 'GIÁO VIÊN CHỦ NHIỆM',
      homeroomTeacherName: '',
      homeroomTeacherSignatureImage: undefined,
      headmasterTitle: 'BAN GIÁM HIỆU',
      headmasterName: '',
      headmasterSignatureImage: undefined,
    },
  };
}
