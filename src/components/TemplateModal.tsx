import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  Info,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Plus,
  Trash2,
  Table,
  Check,
  Eye,
  FileCheck2,
  ArrowRight
} from 'lucide-react';
import { 
  AVAILABLE_TEMPLATE_COLUMNS, 
  downloadCustomExcelTemplate, 
  SAMPLE_STUDENTS_FOR_TEMPLATE,
  downloadSampleStudentExcel, 
  downloadSampleStatsTemplateExcel 
} from '../services/excelService';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSampleDataDirectly: () => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  onLoadSampleDataDirectly,
}) => {
  const [activeTab, setActiveTab] = useState<'custom' | 'presets'>('custom');

  // Custom Builder States
  const [schoolName, setSchoolName] = useState('Trường THCS Thư Vũ');
  const [examTitle, setExamTitle] = useState('BẢNG ĐIỂM KIỂM TRA KHẢO SÁT HỌC SINH');
  const [academicYear, setAcademicYear] = useState('2026 - 2027');

  // 11 standard columns requested by user:
  // stt, sbd, soPhach, name, dob, gender, school, className, toan, van, anh
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>([
    'stt',
    'sbd',
    'soPhach',
    'name',
    'dob',
    'gender',
    'school',
    'className',
    'toan',
    'van',
    'anh'
  ]);

  const [customSubjects, setCustomSubjects] = useState<string[]>(['Tin học']);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [includeSampleRows, setIncludeSampleRows] = useState(true);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Toggle single column
  const handleToggleColumn = (key: string) => {
    if (key === 'name') return; // Họ tên bắt buộc
    setSelectedColumnKeys((prev) => 
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Quick selection presets
  const handleSelectAll = () => {
    setSelectedColumnKeys(AVAILABLE_TEMPLATE_COLUMNS.map((c) => c.key));
  };

  const handleSelectCoreToanVanAnh = () => {
    setSelectedColumnKeys(['stt', 'sbd', 'name', 'className', 'toan', 'van', 'anh']);
  };

  const handleSelectWithPhach = () => {
    setSelectedColumnKeys(['stt', 'sbd', 'soPhach', 'name', 'className', 'toan', 'van', 'anh']);
  };

  // Add custom subject
  const handleAddCustomSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newSubjectName.trim();
    if (!clean) return;
    if (customSubjects.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setNewSubjectName('');
      return;
    }
    setCustomSubjects((prev) => [...prev, clean]);
    setNewSubjectName('');
  };

  const handleRemoveCustomSubject = (sub: string) => {
    setCustomSubjects((prev) => prev.filter((s) => s !== sub));
  };

  // Active columns for preview
  const activeColumnDefs = useMemo(() => {
    const list: Array<{ key: string; label: string; isSubject?: boolean }> = [];
    selectedColumnKeys.forEach((k) => {
      const found = AVAILABLE_TEMPLATE_COLUMNS.find((c) => c.key === k);
      if (found) {
        list.push({ key: found.key, label: found.headerName, isSubject: found.isSubject });
      }
    });
    customSubjects.forEach((sub) => {
      list.push({ key: `custom_${sub}`, label: sub, isSubject: true });
    });
    return list;
  }, [selectedColumnKeys, customSubjects]);

  // Execute Download Custom Template
  const handleDownloadCustom = () => {
    downloadCustomExcelTemplate({
      schoolName,
      examTitle,
      academicYear,
      selectedColumnKeys,
      customSubjects,
      includeSampleRows,
      sampleRowCount: 30,
    });
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Tệp Mẫu Excel & Tự Tạo Mẫu Tùy Chọn Cột
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Chuẩn 100% Import
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tùy chọn chọn các cột thông tin cần thiết, tải mẫu về nhập điểm và nạp lại vào hệ thống để thống kê tự động
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-slate-50/70 flex items-center gap-4 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'custom'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>Tự tạo tệp mẫu theo tùy chọn cột</span>
            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold">
              Mới
            </span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'presets'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Biểu mẫu quy chuẩn có sẵn</span>
            <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
              2 mẫu
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {activeTab === 'custom' ? (
            <div className="space-y-6">
              {/* Step 1: Banner info inputs */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Thông tin tiêu đề trang in & Đơn vị trường học</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tên Trường / Đơn vị:
                    </label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="VD: Trường THCS Thư Vũ"
                      className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tiêu đề biểu mẫu / Kỳ thi:
                    </label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="VD: BẢNG ĐIỂM KIỂM TRA KHẢO SÁT HỌC SINH"
                      className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Năm học:
                    </label>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder="VD: 2026 - 2027"
                      className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Column Selection */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Chọn các cột thông tin cần tạo trong biểu mẫu ({activeColumnDefs.length} cột đã chọn)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
                    >
                      Chọn tất cả (11 cột)
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectWithPhach}
                      className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors"
                    >
                      Kèm Số phách
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectCoreToanVanAnh}
                      className="text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors"
                    >
                      Toán - Văn - Anh
                    </button>
                  </div>
                </div>

                {/* Information Columns */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Thông tin hồ sơ học sinh:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {AVAILABLE_TEMPLATE_COLUMNS.filter((c) => c.group === 'info').map((col) => {
                      const isSelected = selectedColumnKeys.includes(col.key);
                      const isRequired = col.required;
                      return (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isRequired}
                            onChange={() => handleToggleColumn(col.key)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span className="flex-1">{col.label}</span>
                          {isRequired && (
                            <span className="text-[9.5px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                              Bắt buộc
                            </span>
                          )}
                          {col.key === 'soPhach' && (
                            <span className="text-[9.5px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                              Phách
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Subject Columns */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">
                    Cột điểm các môn thi / kiểm tra:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {AVAILABLE_TEMPLATE_COLUMNS.filter((c) => c.group === 'subject').map((col) => {
                      const isSelected = selectedColumnKeys.includes(col.key);
                      return (
                        <label
                          key={col.key}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleColumn(col.key)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                          />
                          <span className="flex-1">Môn {col.label}</span>
                          <span className="text-[9.5px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                            Điểm
                          </span>
                        </label>
                      );
                    })}

                    {/* Custom Added Subjects */}
                    {customSubjects.map((sub) => (
                      <div
                        key={sub}
                        className="flex items-center justify-between gap-1.5 p-2.5 rounded-xl border bg-emerald-50 border-emerald-300 text-emerald-950 text-xs font-semibold"
                      >
                        <span className="truncate">Môn {sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomSubject(sub)}
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded transition-colors"
                          title="Xóa môn này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add more subjects inline form */}
                  <form onSubmit={handleAddCustomSubject} className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="Thêm môn khác (VD: Khoa học tự nhiên, GDCD, Lịch sử & Địa lý...)"
                      className="text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 flex-1 max-w-md"
                    />
                    <button
                      type="submit"
                      disabled={!newSubjectName.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm môn</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Step 3: Options (Sample rows vs Blank) */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900">Dữ liệu dòng khi xuất tệp Excel:</p>
                  <p className="text-[11px] text-slate-500">
                    Bạn muốn có sẵn dòng học sinh mẫu để tham khảo hay tạo mẫu ô trống để nhập liệu mới hoàn toàn?
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIncludeSampleRows(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      includeSampleRows
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Kèm 5 học sinh mẫu (Khuyên dùng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncludeSampleRows(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      !includeSampleRows
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Tệp trắng (30 dòng trống)
                  </button>
                </div>
              </div>

              {/* Step 4: Live Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <Eye className="w-4 h-4 text-indigo-600" />
                    <span>Bản xem trước trực quan cấu trúc cột trong tệp Excel</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Tổng cộng: <strong className="text-indigo-700">{activeColumnDefs.length} cột</strong>
                  </span>
                </div>

                <div className="overflow-x-auto p-3 bg-white">
                  {/* Banner header simulation */}
                  <div className="text-center py-2 border-b border-dashed border-slate-200 mb-2">
                    <p className="font-serif font-bold text-slate-900 text-sm tracking-wide">
                      {examTitle ? examTitle.toUpperCase() : 'DANH SÁCH VÀO ĐIỂM HỌC SINH'}
                    </p>
                    <p className="text-[11px] italic text-slate-500">
                      Năm học: {academicYear} | Đơn vị: {schoolName}
                    </p>
                  </div>

                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-indigo-900 text-white divide-x divide-indigo-800">
                        {activeColumnDefs.map((col, idx) => (
                          <th key={idx} className="px-3 py-2 font-bold text-center whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                      {includeSampleRows ? (
                        SAMPLE_STUDENTS_FOR_TEMPLATE.map((st, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-50 divide-x divide-slate-200">
                            {activeColumnDefs.map((col, cIdx) => {
                              let val: any = '-';
                              if (col.key === 'stt') val = sIdx + 1;
                              else if (col.key === 'sbd') val = st.sbd;
                              else if (col.key === 'soPhach') val = st.soPhach;
                              else if (col.key === 'name') val = st.name;
                              else if (col.key === 'dob') val = st.dob;
                              else if (col.key === 'gender') val = st.gender;
                              else if (col.key === 'school') val = schoolName || st.school;
                              else if (col.key === 'className') val = st.className;
                              else if (col.key === 'toan') val = st.scores['Toán'] ?? 8.5;
                              else if (col.key === 'van') val = st.scores['Ngữ văn'] ?? 8.0;
                              else if (col.key === 'anh') val = st.scores['Tiếng Anh'] ?? 9.0;
                              else if (col.isSubject) val = 8.5;

                              const isText = col.key === 'name' || col.key === 'school';
                              return (
                                <td 
                                  key={cIdx} 
                                  className={`px-3 py-1.5 whitespace-nowrap text-slate-700 ${
                                    isText ? 'text-left font-semibold' : 'text-center'
                                  }`}
                                >
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        [1, 2, 3].map((rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50 divide-x divide-slate-200 text-slate-400">
                            {activeColumnDefs.map((col, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 text-center">
                                {col.key === 'stt' ? rIdx : '...'}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Banner */}
              <div className="bg-gradient-to-r from-indigo-50 via-emerald-50 to-white border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      Tệp Excel đã sẵn sàng tải về:
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Tệp được định dạng chuẩn A4 ngang (Landscape), căn khít trang in, tương thích 100% với mục <strong>"Tạo lần thống kê mới"</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCustom}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-300 transition-all active:scale-[0.98] shrink-0"
                >
                  {downloadSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Đã tải về máy thành công!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Tải về tệp mẫu Excel tùy chỉnh (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Tab 2: Standard Presets */
            <div className="space-y-5">
              {/* Card Template 1 */}
              <div className="border border-slate-200 rounded-xl p-5 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all bg-white shadow-2xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-700">
                        MẪU 1 CHUẨN (169 HỌC SINH - 5 LỚP)
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Tệp Mẫu Nhập Điểm Học Sinh (Mau_Danh_Sach_Diem_Hoc_Sinh.xlsx)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Đúng 100% cấu trúc các cột chuẩn theo tệp <strong>tệp mẫu nhập điểm kiểm tra.pdf</strong>: <br />
                      <span className="font-mono text-[11px] text-indigo-700 font-semibold bg-indigo-50/80 px-1.5 py-0.5 rounded mt-1 inline-block">
                        STT | số báo danh | Họ và tên | Ngày sinh | Lớp | Phòng thi | Toán | văn | Anh | Tin
                      </span>
                    </p>
                    <div className="pt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                        Trường THCS Thư Vũ
                      </span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">169 học sinh (5 lớp: 9A1 - 9A5)</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">Mau_Danh_Sach_Diem_Hoc_Sinh.xlsx (15.2 KB)</span>
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">Đã căn vừa khít 1 trang ngang</span>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadSampleStudentExcel()}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Mẫu 1 (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Card Template 2 */}
              <div className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all bg-white shadow-2xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700">
                        MẪU 2
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Tệp Mẫu Bảng Thống Kê Điểm Chuẩn (Theo Trường, Lớp, Môn)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Bảng ma trận thống kê phân bổ các mốc điểm từ 0 đến 10: <strong>[0 - &lt;1], [1 - &lt;2], ... [9 - 10]</strong>, Điểm trung bình, Điểm cao nhất, thấp nhất, Tỉ lệ đạt (≥ 5.0) và Tỉ lệ giỏi (≥ 8.0).
                    </p>
                    <div className="pt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Trường THCS Thư Vũ</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Chuẩn Bộ Giáo dục</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded">Thống kê đa chiều</span>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadSampleStatsTemplateExcel()}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Mẫu 2 (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Quick Demo Action */}
              <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 rounded-xl p-4 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Muốn nạp dữ liệu trải nghiệm ngay?</p>
                    <p className="text-[11px] text-slate-600">Nạp dữ liệu mẫu 169 học sinh (5 lớp: 9A1 - 9A5) Trường THCS Thư Vũ vào phần mềm chỉ với 1 click.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onLoadSampleDataDirectly();
                    onClose();
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
                >
                  Nạp dữ liệu mẫu Thư Vũ
                </button>
              </div>
            </div>
          )}

          {/* Flexible Column Tolerance Notice */}
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-800">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900">Tính năng nhận diện linh hoạt thông minh:</span>
              <p>
                Sau khi tải tệp mẫu về và nhập điểm cho học sinh, bạn tải lên trong chức năng <strong>"Tạo lần thống kê mới"</strong>. Dù tệp chỉ có 2-3 môn hoặc thiếu bất kỳ cột nào không bắt buộc, hệ thống vẫn tự động khớp dữ liệu và thống kê chính xác tuyệt đối.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            Tác giả: <strong className="text-indigo-700">Vũ Văn Nhật - THCS Thư Vũ</strong> (SĐT: 0972486482)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
