import React, { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  School,
  User,
  Users,
  Settings2,
  CheckCircle2,
  Sparkles,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  UploadCloud,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { StatisticSession, Student } from '../types';
import {
  GradeSlipOptions,
  exportGradeSlipsToWord,
  printGradeSlips,
  getAutoComment,
} from '../services/gradeSlipService';

interface GradeSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StatisticSession;
  initialClass?: string;
  initialStudentId?: string;
}

export const GradeSlipModal: React.FC<GradeSlipModalProps> = ({
  isOpen,
  onClose,
  session,
  initialClass,
  initialStudentId,
}) => {
  // 1. Scope selection: 'class' (all students in selected class), 'single' (one specific student), 'all' (all classes)
  const [scope, setScope] = useState<'class' | 'single' | 'all'>('class');

  // Selected class
  const [selectedClass, setSelectedClass] = useState<string>(
    initialClass || session.classes[0] || ''
  );

  // Selected student
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || ''
  );

  // Search filter for students
  const [studentSearch, setStudentSearch] = useState('');

  // Customizable slip options
  const [departmentName, setDepartmentName] = useState('UBND xã..........................');
  const [schoolName, setSchoolName] = useState(session.schoolName || 'TRƯỜNG ....................................');
  const [academicYear, setAcademicYear] = useState(session.academicYear || '20... – 20...');
  const [examDate, setExamDate] = useState('......../......../............');
  const [signDate, setSignDate] = useState('...................., ngày ...... tháng ...... năm 20......');
  const [autoComment, setAutoComment] = useState(false);
  const [customTeacherName, setCustomTeacherName] = useState('');
  const [teacherSignatureImage, setTeacherSignatureImage] = useState<string | null>(null);
  const [schoolRepresentativeName, setSchoolRepresentativeName] = useState('');
  const [schoolRepresentativeSignatureImage, setSchoolRepresentativeSignatureImage] = useState<string | null>(null);
  const teacherSigInputRef = React.useRef<HTMLInputElement>(null);
  const schoolRepSigInputRef = React.useRef<HTMLInputElement>(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const handleTeacherSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === 'string') {
          setTeacherSignatureImage(evt.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSchoolRepSigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === 'string') {
          setSchoolRepresentativeSignatureImage(evt.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Zoom level for preview
  const [zoomLevel, setZoomLevel] = useState(95);

  // Loading states
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Students in selected class
  const classStudents = useMemo(() => {
    return session.students
      .filter((s) => s.className === selectedClass)
      .sort((a, b) => a.classRank - b.classRank);
  }, [session, selectedClass]);

  // Set initial student when class or modal opens
  React.useEffect(() => {
    if (initialStudentId) {
      const target = session.students.find((s) => s.id === initialStudentId);
      if (target) {
        setSelectedClass(target.className);
        setSelectedStudentId(target.id);
        setScope('single');
        return;
      }
    }
    if (classStudents.length > 0 && !classStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(classStudents[0].id);
    }
  }, [classStudents, initialStudentId, selectedStudentId, session.students]);

  // Current preview student
  const currentPreviewStudent = useMemo(() => {
    if (selectedStudentId) {
      const found = session.students.find((s) => s.id === selectedStudentId);
      if (found) return found;
    }
    return classStudents[0] || session.students[0] || null;
  }, [selectedStudentId, session.students, classStudents]);

  // Current preview student index in its class
  const currentStudentIndex = useMemo(() => {
    if (!currentPreviewStudent) return 0;
    return classStudents.findIndex((s) => s.id === currentPreviewStudent.id);
  }, [classStudents, currentPreviewStudent]);

  // Homeroom teacher of current selected class - để trống theo yêu cầu để thầy cô ký và ghi rõ họ tên
  const currentTeacher = useMemo(() => {
    return customTeacherName.trim();
  }, [customTeacherName]);

  // Target students to process based on scope
  const targetStudents = useMemo(() => {
    if (scope === 'single') {
      return currentPreviewStudent ? [currentPreviewStudent] : [];
    }
    if (scope === 'class') {
      return classStudents;
    }
    // scope === 'all'
    return [...session.students].sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.classRank - b.classRank;
    });
  }, [scope, currentPreviewStudent, classStudents, session.students]);

  // Options bundle
  const slipOptions: GradeSlipOptions = useMemo(() => ({
    departmentName,
    schoolName,
    academicYear,
    examDate,
    signDate,
    homeroomTeacherName: currentTeacher,
    homeroomTeacherSignatureImage: teacherSignatureImage || undefined,
    schoolRepresentativeName: schoolRepresentativeName.trim() || undefined,
    schoolRepresentativeSignatureImage: schoolRepresentativeSignatureImage || undefined,
    autoComment,
  }), [
    departmentName,
    schoolName,
    academicYear,
    examDate,
    signDate,
    currentTeacher,
    teacherSignatureImage,
    schoolRepresentativeName,
    schoolRepresentativeSignatureImage,
    autoComment,
  ]);

  // Navigate through students
  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(classStudents[currentStudentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex < classStudents.length - 1) {
      setSelectedStudentId(classStudents[currentStudentIndex + 1].id);
    }
  };

  // Perform Word export
  const handleExportWord = async () => {
    if (targetStudents.length === 0) return;
    setIsExportingWord(true);
    try {
      let fileName = '';
      if (scope === 'single' && currentPreviewStudent) {
        fileName = `Phieu_Bao_Diem_${currentPreviewStudent.className}_${currentPreviewStudent.name.replace(/\s+/g, '_')}.docx`;
      } else if (scope === 'class') {
        fileName = `Phieu_Bao_Diem_Lop_${selectedClass}_${classStudents.length}HS.docx`;
      } else {
        fileName = `Phieu_Bao_Diem_Tat_Ca_Cac_Lop_${session.name.replace(/\s+/g, '_')}.docx`;
      }

      await exportGradeSlipsToWord(targetStudents, session, slipOptions, fileName);
    } catch (err) {
      console.error('Lỗi xuất file Word phiếu báo điểm:', err);
    } finally {
      setIsExportingWord(false);
    }
  };

  // Perform direct print
  const handleDirectPrint = () => {
    if (targetStudents.length === 0) return;
    setIsPrinting(true);
    try {
      printGradeSlips(targetStudents, session, slipOptions);
    } finally {
      setTimeout(() => setIsPrinting(false), 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-7xl w-full shadow-2xl border border-slate-200 flex flex-col h-[95vh] max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-blue-50/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-700 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  In & Xuất Phiếu Báo Điểm Học Sinh
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Mỗi HS 1 trang • Hỗ trợ In & Word (.docx)
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Định dạng chuẩn biểu mẫu Bộ GD&ĐT: Kính gửi phụ huynh, bảng điểm các môn, xếp thứ và nhận xét của GVCN
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body: 2 Columns (Left Controls, Right Live Preview) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT PANEL: Scope, Class, Student Selection, and Customization */}
          <div className="w-full lg:w-96 xl:w-[420px] border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/60 p-4 overflow-y-auto space-y-4 shrink-0">
            {/* 1. Chọn phạm vi xuất / in */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Phạm vi in / xuất phiếu:</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setScope('class')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-md transition-all ${
                    scope === 'class'
                      ? 'bg-white text-blue-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo Lớp
                </button>
                <button
                  type="button"
                  onClick={() => setScope('single')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-md transition-all ${
                    scope === 'single'
                      ? 'bg-white text-blue-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Từng Học Sinh
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`py-1.5 px-2 text-xs font-bold rounded-md transition-all ${
                    scope === 'all'
                      ? 'bg-white text-blue-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Toàn Trường
                </button>
              </div>

              {/* Status summary */}
              <div className="text-[11px] text-slate-600 bg-blue-50/60 border border-blue-100 rounded-lg p-2 flex items-center justify-between">
                <span>Số lượng phiếu sẽ tạo:</span>
                <span className="font-bold text-blue-800 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                  {targetStudents.length} học sinh
                </span>
              </div>
            </div>

            {/* 2. Chọn Lớp học */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                <span>Chọn Lớp:</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {session.classes.map((cName) => {
                  const count = session.students.filter((s) => s.className === cName).length;
                  const isSelected = selectedClass === cName;
                  return (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => {
                        setSelectedClass(cName);
                        setCustomTeacherName('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>Lớp {cName}</span>
                      <span className="ml-1.5 opacity-75 text-[10px]">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Danh sách học sinh trong lớp (để chọn xem trước hoặc in từng em) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {scope === 'single' ? 'Chọn học sinh cần in:' : 'Học sinh đang xem trước:'}
                  </span>
                </label>
                <span className="text-[11px] text-slate-500">
                  {currentStudentIndex + 1} / {classStudents.length}
                </span>
              </div>

              {/* Search box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên học sinh, SBD..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Student list */}
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-lg p-1 bg-slate-50/50">
                {classStudents
                  .filter((s) => {
                    if (!studentSearch.trim()) return true;
                    const q = studentSearch.toLowerCase();
                    return s.name.toLowerCase().includes(q) || s.sbd.toLowerCase().includes(q);
                  })
                  .map((st) => {
                    const isSelected = currentPreviewStudent?.id === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStudentId(st.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-mono text-[11px] opacity-80 mr-1.5">[{st.sbd}]</span>
                          <span>{st.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-[10px]">
                          <span className={`px-1.5 py-0.2 rounded ${isSelected ? 'bg-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                            #{st.classRank}
                          </span>
                          <span className={`font-mono font-bold ${isSelected ? 'text-blue-100' : 'text-slate-900'}`}>
                            {st.totalScore.toFixed(1)}đ
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Slider prev/next controls */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handlePrevStudent}
                  disabled={currentStudentIndex <= 0}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Em trước</span>
                </button>
                <span className="text-[11px] text-slate-600 font-medium truncate max-w-[170px]">
                  {currentPreviewStudent?.name}
                </span>
                <button
                  type="button"
                  onClick={handleNextStudent}
                  disabled={currentStudentIndex >= classStudents.length - 1}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <span>Em sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4. Tùy chỉnh thông tin phiếu báo điểm (Collapsible) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                className="w-full p-3.5 text-left flex items-center justify-between bg-slate-50/60 hover:bg-slate-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Tùy chỉnh thông tin phiếu
                  </span>
                </div>
                <span className="text-[11px] text-blue-600 font-semibold">
                  {isOptionsOpen ? 'Thu gọn ▲' : 'Chỉnh sửa ▼'}
                </span>
              </button>

              {isOptionsOpen && (
                <div className="p-3.5 space-y-3 border-t border-slate-200 bg-white">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Cơ quan cấp trên / UBND xã:
                    </label>
                    <input
                      type="text"
                      value={departmentName}
                      onChange={(e) => setDepartmentName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                      placeholder="UBND xã.........................."
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Tên trường học:
                    </label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Năm học:
                      </label>
                      <input
                        type="text"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Ngày kiểm tra:
                      </label>
                      <input
                        type="text"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Dòng ngày tháng ký (Góc dưới phải):
                    </label>
                    <input
                      type="text"
                      value={signDate}
                      onChange={(e) => setSignDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg italic"
                    />
                  </div>

                  {/* 1. Giáo viên chủ nhiệm */}
                  <div className="space-y-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="text-[11px] font-bold text-slate-800 block">
                      Tên Giáo viên chủ nhiệm:
                    </label>
                    <input
                      type="text"
                      value={customTeacherName}
                      onChange={(e) => setCustomTeacherName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      placeholder="(Để trống để ký và ghi họ tên bằng tay)"
                    />

                    {/* Upload ảnh chữ ký GVCN */}
                    <div className="pt-0.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span className="font-semibold">Ảnh chữ ký GVCN:</span>
                        {teacherSignatureImage && (
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherSignatureImage(null);
                              if (teacherSigInputRef.current) teacherSigInputRef.current.value = '';
                            }}
                            className="text-[10px] text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa ảnh
                          </button>
                        )}
                      </div>

                      {teacherSignatureImage ? (
                        <div className="p-1.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                          <img
                            src={teacherSignatureImage}
                            alt="Chữ ký GVCN"
                            className="h-9 max-w-[120px] object-contain border border-slate-100 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => teacherSigInputRef.current?.click()}
                            className="text-[11px] text-indigo-600 hover:underline font-semibold"
                          >
                            Đổi ảnh
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => teacherSigInputRef.current?.click()}
                          className="w-full py-1.5 px-2 border border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 rounded-lg text-slate-600 hover:text-indigo-600 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Chèn ảnh chữ ký có sẵn trong máy</span>
                        </button>
                      )}
                      <input
                        ref={teacherSigInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleTeacherSigUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* 2. Đại diện nhà trường */}
                  <div className="space-y-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="text-[11px] font-bold text-slate-800 block">
                      Tên người Đại diện nhà trường:
                    </label>
                    <input
                      type="text"
                      value={schoolRepresentativeName}
                      onChange={(e) => setSchoolRepresentativeName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      placeholder="Ví dụ: Hiệu trưởng ThS. Nguyễn Văn A (hoặc để trống)"
                    />

                    {/* Upload ảnh con dấu hoặc chữ ký đại diện */}
                    <div className="pt-0.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span className="font-semibold">Ảnh con dấu / Chữ ký ĐD:</span>
                        {schoolRepresentativeSignatureImage && (
                          <button
                            type="button"
                            onClick={() => {
                              setSchoolRepresentativeSignatureImage(null);
                              if (schoolRepSigInputRef.current) schoolRepSigInputRef.current.value = '';
                            }}
                            className="text-[10px] text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa ảnh
                          </button>
                        )}
                      </div>

                      {schoolRepresentativeSignatureImage ? (
                        <div className="p-1.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                          <img
                            src={schoolRepresentativeSignatureImage}
                            alt="Dấu / Chữ ký ĐD"
                            className="h-10 max-w-[120px] object-contain border border-slate-100 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => schoolRepSigInputRef.current?.click()}
                            className="text-[11px] text-indigo-600 hover:underline font-semibold"
                          >
                            Đổi ảnh
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => schoolRepSigInputRef.current?.click()}
                          className="w-full py-1.5 px-2 border border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 rounded-lg text-slate-600 hover:text-indigo-600 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Chèn ảnh con dấu / chữ ký trong máy</span>
                        </button>
                      )}
                      <input
                        ref={schoolRepSigInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSchoolRepSigUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoComment}
                        onChange={(e) => setAutoComment(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        Tự động gợi ý nhận xét GVCN theo học lực/thứ hạng
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-400 pl-6 mt-0.5">
                      Nếu không chọn, phiếu sẽ để 2 dòng chấm để thầy cô ghi nhận xét bằng tay.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick guidance notes */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Quy chuẩn tệp Word & In:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800/90">
                Khi xuất Word hoặc in, mỗi học sinh được cố định trên <strong>1 trang A4 duy nhất</strong> có ngắt trang chuẩn (Page Break), mở bằng MS Word hay in ra đều chuẩn khít.
              </p>
            </div>
          </div>

          {/* RIGHT PANEL: Live A4 Visual Preview */}
          <div className="flex-1 bg-slate-200/70 p-3 sm:p-6 flex flex-col overflow-hidden">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between mb-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Xem trước phiếu báo điểm:</span>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {currentPreviewStudent ? `${currentPreviewStudent.name} (Lớp ${currentPreviewStudent.className})` : 'Chưa chọn'}
                </span>
              </div>

              {/* Zoom controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-semibold text-slate-600 w-10 text-center">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(95)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 ml-1"
                  title="Khôi phục mặc định"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Paper Container */}
            <div className="flex-1 overflow-auto flex justify-center items-start p-2">
              {currentPreviewStudent ? (
                <div
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: 'top center',
                    width: '210mm',
                    minHeight: '297mm',
                    fontFamily: '"Times New Roman", "Tinos", Times, "Liberation Serif", serif',
                  }}
                  className="bg-white shadow-xl rounded-sm p-10 font-times text-slate-900 border border-slate-300 transition-transform duration-150 flex flex-col justify-between shrink-0 [&_*]:font-['Times_New_Roman',Tinos,Times,serif]"
                >
                  <div>
                    {/* 1. Header (Quốc hiệu & Đơn vị) */}
                    <div className="flex justify-between items-start text-center mb-4">
                      <div className="w-[48%]">
                        <p className="font-bold text-[13px] uppercase">{departmentName}</p>
                        <p className="font-bold text-[13px] uppercase mt-0.5">TRƯỜNG: {schoolName}</p>
                        <div className="w-24 h-px bg-slate-400 mx-auto mt-1" />
                      </div>
                      <div className="w-[50%]">
                        <p className="font-bold text-[13px] uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                        <p className="font-bold text-[13px] mt-0.5">Độc lập – Tự do – Hạnh phúc</p>
                        <div className="w-28 h-px bg-slate-900 mx-auto mt-1" />
                      </div>
                    </div>

                    {/* 2. Tiêu đề chính */}
                    <div className="text-center my-4">
                      <h1 className="text-2xl font-bold tracking-wide uppercase text-[#1f4e79]">
                        GIẤY BÁO ĐIỂM
                      </h1>
                      <p className="font-bold text-[13px] text-slate-800 mt-1">
                        Năm học {academicYear}
                      </p>
                    </div>

                    {/* 3. Kính gửi & Lời mở đầu */}
                    <div className="mb-3 text-[13.5px] leading-relaxed">
                      <p>
                        <span className="font-bold">Kính gửi:</span> Ông/Bà ....................................................................................................................
                      </p>
                      <p className="italic text-[13px] text-slate-700 mt-1">
                        Nhà trường trân trọng thông báo kết quả học tập/kiểm tra của học sinh như sau:
                      </p>
                    </div>

                    {/* 4. Bảng thông tin học sinh */}
                    <table className="w-full border-collapse border border-slate-700 mb-4 text-[13px]">
                      <tbody>
                        <tr>
                          <td className="border border-slate-700 px-3 py-1.5 w-1/2">
                            <span className="font-bold">Họ và tên học sinh: </span>
                            <span className="font-bold uppercase text-[#1f4e79]">
                              {currentPreviewStudent.name}
                            </span>
                          </td>
                          <td className="border border-slate-700 px-3 py-1.5 w-1/2">
                            <span className="font-bold">Ngày sinh: </span>
                            <span>{currentPreviewStudent.dob || '......../......../............'}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 px-3 py-1.5">
                            <span className="font-bold">Lớp: </span>
                            <span className="font-bold">{currentPreviewStudent.className}</span>
                          </td>
                          <td className="border border-slate-700 px-3 py-1.5">
                            <span className="font-bold">Trường: </span>
                            <span>{schoolName}</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-slate-700 px-3 py-1.5">
                            <span className="font-bold">Kỳ kiểm tra/kỳ thi: </span>
                            <span>{session.name}</span>
                          </td>
                          <td className="border border-slate-700 px-3 py-1.5">
                            <span className="font-bold">Ngày kiểm tra: </span>
                            <span>{examDate}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 5. Tiêu đề kết quả */}
                    <div className="text-center my-3">
                      <h2 className="text-base font-bold tracking-wide uppercase text-[#1f4e79]">
                        KẾT QUẢ ĐIỂM VÀ XẾP HẠNG
                      </h2>
                    </div>

                    {/* 6. Bảng điểm và xếp thứ */}
                    <table className="w-full border-collapse border border-slate-700 text-center mb-4 text-[12.5px]">
                      <thead>
                        <tr className="bg-slate-100 font-bold">
                          <th className="border border-slate-700 px-2 py-1.5 uppercase">Môn học</th>
                          {session.subjects.map((sub) => (
                            <th key={sub} className="border border-slate-700 px-2 py-1.5 uppercase">
                              {sub}
                            </th>
                          ))}
                          <th className="border border-slate-700 px-2 py-1.5 uppercase bg-blue-50/70">
                            Tổng điểm
                          </th>
                          <th className="border border-slate-700 px-2 py-1.5 uppercase">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-700 px-2 py-1.5 font-bold bg-slate-50">
                            Điểm
                          </td>
                          {session.subjects.map((sub) => {
                            const sc = currentPreviewStudent.scores[sub];
                            return (
                              <td key={sub} className="border border-slate-700 px-2 py-1.5 font-bold">
                                {sc !== null && sc !== undefined ? sc.toFixed(1) : '-'}
                              </td>
                            );
                          })}
                          <td className="border border-slate-700 px-2 py-1.5 font-bold text-[#1f4e79] bg-blue-50/50">
                            {currentPreviewStudent.totalScore.toFixed(2)}
                          </td>
                          <td className="border border-slate-700 px-2 py-1.5 text-xs">
                            {currentPreviewStudent.notes || ''}
                          </td>
                        </tr>
                        <tr className="bg-slate-50 font-bold text-[12px]">
                          <td
                            colSpan={Math.max(1, Math.floor((session.subjects.length + 3) / 3))}
                            className="border border-slate-700 px-2 py-1.5 bg-emerald-50 text-emerald-900"
                          >
                            Xếp thứ trong lớp
                          </td>
                          <td
                            colSpan={Math.max(1, Math.floor((session.subjects.length + 3) / 3))}
                            className="border border-slate-700 px-2 py-1.5 bg-amber-50 text-amber-900"
                          >
                            Xếp thứ toàn trường
                          </td>
                          <td
                            colSpan={Math.max(
                              1,
                              session.subjects.length + 3 - 2 * Math.max(1, Math.floor((session.subjects.length + 3) / 3))
                            )}
                            className="border border-slate-700 px-2 py-1.5 bg-slate-100"
                          >
                            Tổng số học sinh
                          </td>
                        </tr>
                        <tr className="font-bold text-[13px]">
                          <td
                            colSpan={Math.max(1, Math.floor((session.subjects.length + 3) / 3))}
                            className="border border-slate-700 px-2 py-1.5 text-emerald-700"
                          >
                            #{currentPreviewStudent.classRank} / {classStudents.length}
                          </td>
                          <td
                            colSpan={Math.max(1, Math.floor((session.subjects.length + 3) / 3))}
                            className="border border-slate-700 px-2 py-1.5 text-amber-700"
                          >
                            #{currentPreviewStudent.schoolRank} / {session.students.length}
                          </td>
                          <td
                            colSpan={Math.max(
                              1,
                              session.subjects.length + 3 - 2 * Math.max(1, Math.floor((session.subjects.length + 3) / 3))
                            )}
                            className="border border-slate-700 px-2 py-1.5 text-slate-700 text-xs"
                          >
                            {classStudents.length} HS (Lớp) - {session.students.length} HS (Trường)
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 7. Nhận xét của giáo viên chủ nhiệm */}
                    <div className="mb-4 text-[13px] leading-relaxed">
                      <p className="font-bold mb-1">Nhận xét của giáo viên chủ nhiệm:</p>
                      {autoComment ? (
                        <p className="italic bg-slate-50 p-2 border-l-2 border-[#1f4e79] text-slate-800">
                          {getAutoComment(currentPreviewStudent)}
                        </p>
                      ) : (
                        <div className="space-y-1 text-slate-400 select-none overflow-hidden text-[12px]">
                          <p className="truncate">................................................................................................................................................................................................</p>
                          <p className="truncate">................................................................................................................................................................................................</p>
                        </div>
                      )}
                      <p className="mt-2">
                        <span className="font-bold">Thông tin bổ sung (nếu có): </span>
                        <span className="text-slate-400">........................................................................................................................</span>
                      </p>
                    </div>

                    {/* 8. Chữ ký 3 cột */}
                    <div className="grid grid-cols-3 gap-3 text-center text-[13px] mt-6">
                      <div>
                        <p className="font-bold uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
                        <p className="text-xs text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
                        <div className="min-h-[4.5rem] flex flex-col items-center justify-end">
                          {teacherSignatureImage && (
                            <img
                              src={teacherSignatureImage}
                              alt="Chữ ký GVCN"
                              className="max-h-12 max-w-[120px] object-contain mb-1"
                            />
                          )}
                          <div className="font-bold text-slate-900 text-xs">
                            {currentTeacher}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="font-bold uppercase">ĐẠI DIỆN NHÀ TRƯỜNG</p>
                        <p className="text-xs text-slate-500 italic mt-0.5">(Ký, đóng dấu)</p>
                        <div className="min-h-[4.5rem] flex flex-col items-center justify-end">
                          {schoolRepresentativeSignatureImage && (
                            <img
                              src={schoolRepresentativeSignatureImage}
                              alt="Dấu / Chữ ký đại diện"
                              className="max-h-14 max-w-[110px] object-contain mb-1"
                            />
                          )}
                          <div className="font-bold text-slate-900 text-xs">
                            {schoolRepresentativeName.trim()}
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="font-bold uppercase">PHỤ HUYNH HỌC SINH</p>
                        <p className="text-xs text-slate-500 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
                        <div className="min-h-[4.5rem]" />
                      </div>
                    </div>
                  </div>

                  {/* 9. Dòng ngày tháng chân trang */}
                  <div className="text-right text-[12px] italic text-slate-600 mt-4 pr-4">
                    {signDate}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  Không tìm thấy học sinh để hiển thị
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Sẵn sàng in/xuất <strong>{targetStudents.length} phiếu báo điểm</strong> ({scope === 'class' ? `Lớp ${selectedClass}` : scope === 'single' ? currentPreviewStudent?.name : 'Toàn trường'}).
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-2xs"
            >
              Đóng
            </button>

            {/* Nút Xuất file Word (.docx) */}
            <button
              type="button"
              onClick={handleExportWord}
              disabled={isExportingWord || targetStudents.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs transition-all active:scale-98"
              title="Xuất các phiếu báo điểm vào file Word (.docx) chuẩn biểu mẫu, mỗi học sinh 1 trang ngắt trang"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>{isExportingWord ? 'Đang tạo Word...' : 'Xuất File Word (.docx)'}</span>
            </button>

            {/* Nút In trực tiếp qua máy in */}
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isPrinting || targetStudents.length === 0}
              className="inline-flex items-center gap-2 px-4.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 rounded-xl shadow-xs shadow-emerald-200 transition-all active:scale-98"
              title="Gửi lệnh in trực tiếp tới máy in mặc định, mỗi học sinh chuẩn 1 trang A4"
            >
              <Printer className="w-4 h-4 text-emerald-100" />
              <span>{isPrinting ? 'Đang gửi lệnh in...' : 'In Phiếu Báo Điểm'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
