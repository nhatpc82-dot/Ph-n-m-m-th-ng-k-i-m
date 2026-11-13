import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Trophy,
  Medal,
  Award,
  Users,
  GraduationCap,
  Layers,
  Sparkles,
  ArrowUpDown,
  Download,
  CheckCircle,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  Crown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { StatisticSession, Student } from '../types';
import { 
  exportGradeValedictoriansExcel, 
  exportClassValedictoriansExcel 
} from '../services/excelService';

interface OverviewTabProps {
  session: StatisticSession;
  onExportMultiSheet: () => void;
  onOpenGradeSlipModal?: (targetClass?: string, targetStudentId?: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  session,
  onExportMultiSheet,
  onOpenGradeSlipModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'schoolRank' | 'classRank' | 'totalScore' | 'name' | 'stt'>('schoolRank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Lấy danh sách các khối duy nhất có trong session
  const distinctGrades = useMemo(() => {
    if (session.grades && session.grades.length > 0) return session.grades;
    const gSet = new Set<string>();
    session.students.forEach((s) => {
      if (s.grade) gSet.add(s.grade);
    });
    return Array.from(gSet).sort();
  }, [session]);

  // Danh sách các lớp phù hợp theo khối đã chọn
  const availableClasses = useMemo(() => {
    if (selectedGrade === 'ALL') return session.classes;
    return session.classes.filter((c) => {
      const summary = session.classSummaries[c];
      return summary?.grade === selectedGrade;
    });
  }, [session, selectedGrade]);

  // Khi chọn khối mới, nếu lớp hiện tại không thuộc khối đó thì tự động reset về ALL
  useEffect(() => {
    if (selectedGrade !== 'ALL' && selectedClass !== 'ALL') {
      const summary = session.classSummaries[selectedClass];
      if (summary?.grade && summary.grade !== selectedGrade) {
        setSelectedClass('ALL');
      }
    }
  }, [selectedGrade, selectedClass, session.classSummaries]);

  // Học sinh thuộc phạm vi lọc hiện tại (dùng cho thống kê KPIs và Thủ khoa)
  const scopedStudents = useMemo(() => {
    return session.students.filter((s) => {
      if (selectedGrade !== 'ALL' && s.grade !== selectedGrade) return false;
      if (selectedClass !== 'ALL' && s.className !== selectedClass) return false;
      return true;
    });
  }, [session.students, selectedGrade, selectedClass]);

  // Các lớp thuộc phạm vi lọc
  const scopedClasses = useMemo(() => {
    if (selectedClass !== 'ALL') return [selectedClass];
    if (selectedGrade !== 'ALL') return availableClasses;
    return session.classes;
  }, [session.classes, selectedGrade, selectedClass, availableClasses]);

  // Hàm tìm học sinh có điểm cao nhất trong 1 danh sách
  const getTopStudent = (studentsList: Student[]): Student | null => {
    if (!studentsList || studentsList.length === 0) return null;
    return [...studentsList].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.averageScore - a.averageScore;
    })[0];
  };

  // 1. Thủ khoa của phạm vi hiện tại (Toàn trường, Khối, hoặc Lớp)
  const scopedValedictorian = useMemo(() => {
    return getTopStudent(scopedStudents);
  }, [scopedStudents]);

  // 2. Thủ khoa toàn trường (dùng khi ở chế độ ALL)
  const schoolValedictorian = useMemo(() => {
    return getTopStudent(session.students);
  }, [session.students]);

  // 3. Danh sách Thủ khoa các Khối
  const gradeValedictorians = useMemo(() => {
    const list: Array<{ grade: string; student: Student; studentCount: number; classCount: number }> = [];
    distinctGrades.forEach((g) => {
      const gStudents = session.students.filter((s) => s.grade === g);
      const top = getTopStudent(gStudents);
      const classesInGrade = Array.from(new Set(gStudents.map((s) => s.className)));
      if (top) {
        list.push({
          grade: g,
          student: top,
          studentCount: gStudents.length,
          classCount: classesInGrade.length,
        });
      }
    });
    return list;
  }, [session.students, distinctGrades]);

  // 4. Danh sách Thủ khoa các Lớp theo phạm vi
  const classValedictorians = useMemo(() => {
    const targetClasses = selectedGrade !== 'ALL' ? availableClasses : session.classes;
    const list: Array<{ className: string; grade: string; student: Student; studentCount: number }> = [];
    targetClasses.forEach((c) => {
      const cStudents = session.students.filter((s) => s.className === c);
      const top = getTopStudent(cStudents);
      if (top) {
        list.push({
          className: c,
          grade: session.classSummaries[c]?.grade || '',
          student: top,
          studentCount: cStudents.length,
        });
      }
    });
    return list;
  }, [session.students, session.classes, session.classSummaries, selectedGrade, availableClasses]);

  // Thống kê KPIs theo phạm vi đã chọn
  const scopedTotalSum = scopedStudents.reduce((acc, s) => acc + s.totalScore, 0);
  const scopedAvgTotal = scopedStudents.length > 0 ? (scopedTotalSum / scopedStudents.length).toFixed(2) : '0';

  const scopedAbove5Count = scopedStudents.filter((s) => s.averageScore >= 5.0).length;
  const scopedAbove5Percent = scopedStudents.length > 0 ? Math.round((scopedAbove5Count / scopedStudents.length) * 1000) / 10 : 0;

  const scopedMaxScore = scopedStudents.length > 0 ? Math.max(...scopedStudents.map((s) => s.totalScore)) : 0;
  const scopedMinScore = scopedStudents.length > 0 ? Math.min(...scopedStudents.map((s) => s.totalScore)) : 0;

  // Lọc học sinh theo từ khóa tìm kiếm và sắp xếp cho bảng chi tiết
  const filteredStudents = useMemo(() => {
    return scopedStudents
      .filter((s) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
          s.name.toLowerCase().includes(term) ||
          s.sbd.toLowerCase().includes(term) ||
          s.className.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'schoolRank') diff = a.schoolRank - b.schoolRank;
        else if (sortBy === 'classRank') diff = a.classRank - b.classRank;
        else if (sortBy === 'totalScore') diff = b.totalScore - a.totalScore;
        else if (sortBy === 'stt') diff = a.stt - b.stt;
        else if (sortBy === 'name') diff = a.name.localeCompare(b.name, 'vi');

        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [scopedStudents, searchTerm, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleResetFilters = () => {
    setSelectedGrade('ALL');
    setSelectedClass('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Xác định tiêu đề phạm vi đang xem
  const scopeTitle = useMemo(() => {
    if (selectedClass !== 'ALL') return `Lớp ${selectedClass}`;
    if (selectedGrade !== 'ALL') return selectedGrade;
    return 'Toàn trường';
  }, [selectedGrade, selectedClass]);

  return (
    <div className="space-y-6">
      {/* 1. Bộ lọc phạm vi Thống kê (Khối & Lớp) & Thao tác nhanh */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Controls: Chọn Khối & Lớp */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-1">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>Phạm vi thống kê:</span>
            </div>

            {/* Chọn Khối */}
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedClass('ALL');
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">🌟 Tất cả các Khối ({distinctGrades.length})</option>
              {distinctGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* Chọn Lớp */}
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">
                {selectedGrade !== 'ALL'
                  ? `Tất cả các lớp ${selectedGrade} (${availableClasses.length})`
                  : `Tất cả các Lớp (${session.classes.length})`}
              </option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  Lớp {c}
                </option>
              ))}
            </select>

            {/* Nút Đặt lại phạm vi */}
            {(selectedGrade !== 'ALL' || selectedClass !== 'ALL') && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-semibold transition-colors"
                title="Quay về xem thống kê toàn trường"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xem Toàn Trường</span>
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onExportMultiSheet}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors shadow-2xs"
              title="Xuất danh sách điểm thi chuẩn trang in gồm Sheet 1 tổng hợp và các sheet riêng từng lớp"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Xuất Excel tách sheet</span>
            </button>

            {onOpenGradeSlipModal && (
              <button
                onClick={() => onOpenGradeSlipModal(selectedClass !== 'ALL' ? selectedClass : undefined)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors shadow-2xs"
                title="In phiếu báo điểm từng học sinh hoặc xuất file Word (.docx) mỗi em 1 trang"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>In phiếu báo điểm</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Scope Banner */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Đang hiển thị số liệu theo:</span>
            <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
              {scopeTitle}
            </span>
            <span className="text-slate-400">•</span>
            <span>
              <strong>{scopedStudents.length}</strong> học sinh ({scopedClasses.length} lớp)
            </span>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            {selectedClass !== 'ALL'
              ? `Thống kê chi tiết riêng Lớp ${selectedClass}`
              : selectedGrade !== 'ALL'
              ? `Thống kê gộp các lớp thuộc ${selectedGrade}`
              : 'Thống kê tổng hợp toàn trường'}
          </div>
        </div>
      </div>

      {/* 2. Quick Stats KPIs (Thống kê tự động đổi theo Khối / Lớp đã chọn) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Sĩ số & Số Lớp */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {selectedClass !== 'ALL' ? 'Sĩ số Lớp' : selectedGrade !== 'ALL' ? 'Sĩ số Khối' : 'Học sinh & Lớp'}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-slate-900">{scopedStudents.length}</span>
              <span className="text-xs text-slate-500 font-medium">
                {selectedClass !== 'ALL' ? 'học sinh' : `HS / ${scopedClasses.length} lớp`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selectedClass !== 'ALL'
                ? `Khối: ${session.classSummaries[selectedClass]?.grade || 'Chung'}`
                : `Phạm vi: ${scopeTitle}`}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Thủ khoa của phạm vi (Toàn trường / Khối / Lớp) */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-white p-4.5 rounded-2xl border border-amber-200/80 shadow-2xs flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
              <Crown className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">
                {selectedClass !== 'ALL'
                  ? `Thủ khoa Lớp ${selectedClass}`
                  : selectedGrade !== 'ALL'
                  ? `Thủ khoa ${selectedGrade}`
                  : 'Thủ khoa toàn trường'}
              </span>
            </div>
            {scopedValedictorian ? (
              <div className="mt-1">
                <p className="text-sm font-bold text-slate-900 truncate" title={scopedValedictorian.name}>
                  {scopedValedictorian.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-amber-900 font-medium mt-0.5">
                  <span className="font-black text-amber-600 text-base">{scopedValedictorian.totalScore}</span> điểm
                  <span className="bg-amber-100/90 text-amber-900 font-bold px-1.5 py-0.2 rounded text-[10px]">
                    Lớp {scopedValedictorian.className}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">Chưa có dữ liệu</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-200 shrink-0">
            <Medal className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Điểm trung bình của phạm vi */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {selectedClass !== 'ALL' ? 'Điểm TB Lớp' : selectedGrade !== 'ALL' ? 'Điểm TB Khối' : 'Điểm TB Chung'}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-slate-900">{scopedAvgTotal}</span>
              <span className="text-xs text-emerald-600 font-semibold">điểm</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Cao: <strong>{scopedMaxScore}</strong> | Thấp: <strong>{scopedMinScore}</strong>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Tỉ lệ đạt (≥ 5.0) của phạm vi */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tỉ lệ đạt (≥ 5.0)
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-indigo-600">{scopedAbove5Percent}%</span>
              <span className="text-xs text-slate-500">
                ({scopedAbove5Count}/{scopedStudents.length} HS)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Dựa trên điểm TB môn cá nhân
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. KHU VỰC VINH DANH THỦ KHOA (ĐIỀU CHỈNH THEO TOÀN TRƯỜNG / KHỐI / LỚP) */}
      <div className="space-y-4">
        {/* CASE A: Đang chọn 1 LỚP CỤ THỂ -> Chỉ hiển thị Thủ Khoa của Lớp đã chọn (dạng gọn gàng) */}
        {selectedClass !== 'ALL' && scopedValedictorian && (
          <div className="bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 rounded-xl border border-amber-200/90 px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Crown className="w-4 h-4" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-extrabold text-amber-900 uppercase text-[11px] tracking-wide">
                  Thủ Khoa Lớp {selectedClass}:
                </span>
                <span className="font-black text-slate-900 text-sm">
                  {scopedValedictorian.name}
                </span>
                {scopedValedictorian.sbd && (
                  <span className="text-slate-500 text-[11px]">
                    • SBD: <strong className="text-slate-700">{scopedValedictorian.sbd}</strong>
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">
                  • Hạng trường: <strong className="text-slate-700">#{scopedValedictorian.schoolRank}</strong>/{session.students.length}
                </span>
                <span className="text-slate-500 text-[11px]">
                  • Tổng điểm: <strong className="text-amber-700 font-black">{scopedValedictorian.totalScore}</strong>
                </span>
                <span className="text-slate-500 text-[11px]">
                  • ĐTB: <strong className="text-slate-700">{scopedValedictorian.averageScore}</strong>
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              Hạng #1 Lớp
            </span>
          </div>
        )}

        {/* CASE B: Đang chọn 1 KHỐI CỤ THỂ -> Hiển thị Thủ Khoa Khối đó và các Lớp trong Khối */}
        {selectedGrade !== 'ALL' && selectedClass === 'ALL' && (
          <div className="space-y-3">
            {/* Thẻ Thủ khoa Khối (gọn gàng) */}
            {scopedValedictorian && (
              <div className="bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 rounded-xl border border-amber-200/90 px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-extrabold text-amber-900 uppercase text-[11px] tracking-wide">
                      Thủ Khoa {selectedGrade}:
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {scopedValedictorian.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Lớp {scopedValedictorian.className}
                    </span>
                    {scopedValedictorian.sbd && (
                      <span className="text-slate-500 text-[11px]">
                        • SBD: <strong className="text-slate-700">{scopedValedictorian.sbd}</strong>
                      </span>
                    )}
                    <span className="text-slate-500 text-[11px]">
                      • Tổng điểm: <strong className="text-amber-700 font-black">{scopedValedictorian.totalScore}</strong>
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      • ĐTB: <strong className="text-slate-700">{scopedValedictorian.averageScore}</strong>
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                  Top 1 {selectedGrade} ({scopedStudents.length} HS)
                </span>
              </div>
            )}

            {/* Danh sách Thủ khoa các lớp thuộc khối đã chọn */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Medal className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Danh Sách Thủ Khoa Các Lớp Thuộc {selectedGrade} ({classValedictorians.length} Lớp)
                  </h4>
                </div>
                <button
                  onClick={() => exportClassValedictoriansExcel(session, selectedGrade)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0"
                  title={`Tải danh sách học sinh thủ khoa các lớp thuộc ${selectedGrade} dưới dạng file Excel`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Tải Excel DS Thủ khoa Lớp ({selectedGrade})</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {classValedictorians.map(({ className, student, studentCount }) => (
                  <div
                    key={className}
                    className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all bg-slate-50/60 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                          Lớp {className}
                        </span>
                        <span className="text-[10px] text-slate-400">{studentCount} HS</span>
                      </div>
                      <h5 className="font-bold text-slate-900 text-sm mt-1 truncate" title={student.name}>
                        {student.name}
                      </h5>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {student.sbd && <span>SBD: <strong>{student.sbd}</strong> •</span>}
                        <span>Tổng: <strong className="text-amber-600 font-bold">{student.totalScore}</strong></span>
                        <span>• ĐTB: <strong>{student.averageScore}</strong></span>
                        <span>• Hạng trường: <strong>#{student.schoolRank}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CASE C: Đang xem TOÀN TRƯỜNG (selectedGrade === 'ALL' && selectedClass === 'ALL') */}
        {selectedGrade === 'ALL' && selectedClass === 'ALL' && (
          <div className="space-y-3">
            {/* 1. Thủ khoa Toàn trường (Dạng nhỏ gọn thanh lịch) */}
            {schoolValedictorian && (
              <div className="bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 rounded-xl border border-amber-200/90 px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-extrabold text-amber-900 uppercase text-[11px] tracking-wide flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-600 inline" />
                      Thủ Khoa Toàn Trường:
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {schoolValedictorian.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      Lớp {schoolValedictorian.className}{schoolValedictorian.grade ? ` (${schoolValedictorian.grade})` : ''}
                    </span>
                    {schoolValedictorian.sbd && (
                      <span className="text-slate-500 text-[11px]">
                        • SBD: <strong className="text-slate-700">{schoolValedictorian.sbd}</strong>
                      </span>
                    )}
                    <span className="text-slate-500 text-[11px]">
                      • Tổng điểm: <strong className="text-amber-700 font-black">{schoolValedictorian.totalScore}</strong>
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      • ĐTB: <strong className="text-slate-700">{schoolValedictorian.averageScore}</strong>
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                  Top 1 Toàn Trường ({session.students.length} HS)
                </span>
              </div>
            )}

            {/* 2. Danh sách Thủ khoa các Khối (nếu có nhiều khối) */}
            {distinctGrades.length > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Danh Sách Thủ Khoa Theo Các Khối ({distinctGrades.length} Khối)
                    </h4>
                  </div>
                  <button
                    onClick={() => exportGradeValedictoriansExcel(session)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0"
                    title="Tải danh sách học sinh thủ khoa theo khối toàn trường dưới dạng file Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Tải Excel DS Thủ khoa theo Khối</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {gradeValedictorians.map(({ grade, student, studentCount, classCount }) => (
                    <div
                      key={grade}
                      className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300 transition-all flex flex-col justify-between space-y-2 group"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
                            {grade}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {studentCount} HS ({classCount} lớp)
                          </span>
                        </div>
                        <h5 className="font-bold text-slate-900 text-sm mt-2 truncate" title={student.name}>
                          {student.name}
                        </h5>
                        <div className="text-xs text-slate-600 space-y-0.5 mt-1">
                          <p>
                            Lớp: <strong className="text-indigo-700">{student.className}</strong>
                            {student.sbd && <> • SBD: <strong>{student.sbd}</strong></>}
                          </p>
                          <p>
                            Tổng điểm: <strong className="text-amber-700 font-bold">{student.totalScore}</strong> (ĐTB: {student.averageScore})
                          </p>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-amber-800">
                          Hạng trường: #{student.schoolRank}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900">
                          Top 1 {grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Danh sách Thủ khoa các Lớp (Toàn trường) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Medal className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Danh Sách Thủ Khoa Theo Các Lớp Toàn Trường ({session.classes.length} Lớp)
                  </h4>
                </div>
                <button
                  onClick={() => exportClassValedictoriansExcel(session)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors shrink-0"
                  title="Tải danh sách thủ khoa theo lớp toàn trường dưới dạng file Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Tải Excel DS Thủ khoa theo Lớp</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {classValedictorians.map(({ className, grade, student, studentCount }) => (
                  <div
                    key={className}
                    className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all bg-slate-50/60 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                          Lớp {className}
                        </span>
                        {grade && (
                          <span className="text-[10px] text-slate-500 font-medium">({grade})</span>
                        )}
                        <span className="text-[10px] text-slate-400">• {studentCount} HS</span>
                      </div>
                      <h5 className="font-bold text-slate-900 text-sm mt-1 truncate" title={student.name}>
                        {student.name}
                      </h5>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {student.sbd && <span>SBD: <strong>{student.sbd}</strong> •</span>}
                        <span>Tổng: <strong className="text-amber-600 font-bold">{student.totalScore}</strong></span>
                        <span>• ĐTB: <strong>{student.averageScore}</strong></span>
                        <span>• Hạng trường: <strong>#{student.schoolRank}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Controls & Filters cho Bảng Xếp Hạng Chi Tiết */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={`Tìm kiếm trong ${scopeTitle} theo Tên học sinh, SBD hoặc Lớp...`}
              className="w-full pl-9.5 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span>
              Tìm thấy <strong>{filteredStudents.length}</strong> / {scopedStudents.length} học sinh
            </span>
            <span className="text-[11px] text-slate-400 hidden md:inline">
              Huy chương: 🥇 Top 1 Trường • 🥈 Top 2 • 🥉 Top 3
            </span>
          </div>
        </div>
      </div>

      {/* 5. Main Data Table (Bảng Xếp Hạng Chi Tiết) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th
                  onClick={() => handleSort('schoolRank')}
                  className="px-3.5 py-3 cursor-pointer hover:bg-slate-100/70 select-none text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Hạng Trường</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('classRank')}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-100/70 select-none text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Hạng Lớp</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('stt')}
                  className="px-2 py-3 cursor-pointer hover:bg-slate-100/70 select-none text-center"
                >
                  STT
                </th>
                <th className="px-3 py-3">SBD</th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/70 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Họ và Tên</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-3 py-3 text-center">Lớp</th>
                {distinctGrades.length > 1 && (
                  <th className="px-3 py-3 text-center">Khối</th>
                )}
                {session.students.some((s) => s.examRoom) && (
                  <th className="px-2 py-3 text-center">Phòng thi</th>
                )}
                <th className="px-2 py-3 text-center">Ngày sinh</th>

                {/* Dynamic Subject Columns */}
                {session.subjects.map((sub) => (
                  <th key={sub} className="px-3 py-3 text-center text-slate-700">
                    {sub}
                  </th>
                ))}

                <th
                  onClick={() => handleSort('totalScore')}
                  className="px-3.5 py-3 cursor-pointer hover:bg-slate-100/70 select-none text-right bg-indigo-50/60 text-indigo-900"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Tổng điểm</span>
                    <ArrowUpDown className="w-3 h-3 text-indigo-500" />
                  </div>
                </th>
                <th className="px-3 py-3 text-right bg-slate-100/50">Điểm TB</th>
                <th className="px-3 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={session.subjects.length + 10} className="px-4 py-12 text-center text-slate-400">
                    Không tìm thấy học sinh nào phù hợp trong {scopeTitle}.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((st) => {
                  const isTop1 = st.schoolRank === 1;
                  const isTop2 = st.schoolRank === 2;
                  const isTop3 = st.schoolRank === 3;

                  return (
                    <tr
                      key={st.id}
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        isTop1 ? 'bg-amber-50/40 font-semibold' : ''
                      }`}
                    >
                      {/* Hạng Trường */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-full text-xs ${
                            isTop1
                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                              : isTop2
                              ? 'bg-slate-300 text-slate-800'
                              : isTop3
                              ? 'bg-amber-700/20 text-amber-900'
                              : 'text-slate-600'
                          }`}
                        >
                          {isTop1 ? '🥇 #1' : isTop2 ? '🥈 #2' : isTop3 ? '🥉 #3' : `#${st.schoolRank}`}
                        </span>
                      </td>

                      {/* Hạng Lớp */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-full text-xs ${
                            st.classRank === 1
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'text-slate-500'
                          }`}
                        >
                          {st.classRank === 1 ? '👑 #1' : `#${st.classRank}`}
                        </span>
                      </td>

                      {/* STT */}
                      <td className="px-2 py-2.5 text-center text-slate-400 font-mono">
                        {st.stt}
                      </td>

                      {/* SBD */}
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-700">
                        {st.sbd}
                      </td>

                      {/* Họ và Tên */}
                      <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {st.name}
                      </td>

                      {/* Lớp */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {st.className}
                        </span>
                      </td>

                      {/* Khối (nếu có nhiều khối) */}
                      {distinctGrades.length > 1 && (
                        <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-600">
                          {st.grade || '-'}
                        </td>
                      )}

                      {/* Phòng thi (nếu có) */}
                      {session.students.some((s) => s.examRoom) && (
                        <td className="px-2 py-2.5 text-center text-slate-600">
                          {st.examRoom || '-'}
                        </td>
                      )}

                      {/* Ngày sinh */}
                      <td className="px-2 py-2.5 text-center text-slate-500 whitespace-nowrap">
                        {st.dob || '-'}
                      </td>

                      {/* Điểm các môn */}
                      {session.subjects.map((sub) => {
                        const score = st.scores[sub];
                        const isNull = score === null || score === undefined;
                        const isLow = typeof score === 'number' && score < 5.0;
                        const isHigh = typeof score === 'number' && score >= 8.0;

                        return (
                          <td
                            key={sub}
                            className={`px-3 py-2.5 text-center font-semibold tabular-nums ${
                              isNull
                                ? 'text-slate-300'
                                : isLow
                                ? 'text-red-600 font-bold bg-red-50/50'
                                : isHigh
                                ? 'text-emerald-700 font-bold bg-emerald-50/40'
                                : 'text-slate-700'
                            }`}
                          >
                            {isNull ? '-' : score.toFixed(1)}
                          </td>
                        );
                      })}

                      {/* Tổng điểm */}
                      <td className="px-3.5 py-2.5 text-right font-black text-indigo-900 bg-indigo-50/40 tabular-nums text-sm">
                        {st.totalScore.toFixed(2)}
                      </td>

                      {/* Điểm TB */}
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800 bg-slate-50 tabular-nums">
                        {st.averageScore.toFixed(2)}
                      </td>

                      {/* Thao tác: In phiếu báo điểm */}
                      <td className="px-3 py-2.5 text-center">
                        {onOpenGradeSlipModal && (
                          <button
                            onClick={() => onOpenGradeSlipModal(st.className, st.id)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                            title="In phiếu báo điểm cho học sinh này"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Phiếu điểm</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Hiển thị <strong>{filteredStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> -{' '}
            <strong>{Math.min(currentPage * pageSize, filteredStudents.length)}</strong> trong{' '}
            <strong>{filteredStudents.length}</strong> học sinh ({scopeTitle})
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-100 font-semibold transition-colors"
            >
              Trước
            </button>
            <span className="px-3 py-1.5 font-bold text-slate-800">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-100 font-semibold transition-colors"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
