import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Filter,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Percent,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Award,
  Users,
  School,
  ArrowUpDown,
  BookOpen,
  Sliders,
  ChevronRight,
  Info
} from 'lucide-react';
import { ScoreInterval, StatisticSession, SubjectStats } from '../types';
import { exportStandardReportExcel, exportSubjectComparisonExcel } from '../services/excelService';

interface CriteriaStatsTabProps {
  session: StatisticSession;
}

export const CriteriaStatsTab: React.FC<CriteriaStatsTabProps> = ({ session }) => {
  // 4 View scopes
  const [viewScope, setViewScope] = useState<'school' | 'by_class' | 'compare_school' | 'by_subject'>('compare_school');
  const [selectedClass, setSelectedClass] = useState<string>(session.classes[0] || '');
  const [selectedSubject, setSelectedSubject] = useState<string>(session.subjects[0] || '');

  // Sub-views inside Comparison Scope
  const [compareMode, setCompareMode] = useState<'matrix' | 'by_subject' | 'by_class'>('matrix');
  const [activeCompareSubject, setActiveCompareSubject] = useState<string>(session.subjects[0] || '');
  const [activeCompareClass, setActiveCompareClass] = useState<string>(session.classes[0] || '');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');

  // School total average across all students
  const schoolTotalAvg = useMemo(() => {
    if (session.students.length === 0) return 0;
    const sum = session.students.reduce((acc, s) => acc + s.averageScore, 0);
    return Math.round((sum / session.students.length) * 100) / 100;
  }, [session]);

  // Filtered classes by grade
  const displayClasses = useMemo(() => {
    if (selectedGradeFilter === 'ALL') return session.classes;
    return session.classes.filter((c) => session.classSummaries[c]?.grade === selectedGradeFilter);
  }, [session, selectedGradeFilter]);

  // Calculate stats when viewing by class
  const activeClassStats = useMemo(() => {
    if (!selectedClass) return null;
    return session.classSummaries[selectedClass] || null;
  }, [session, selectedClass]);

  // Data for chart when in "by_subject" view
  const subjectChartData = useMemo(() => {
    if (!selectedSubject) return null;
    const overallSub = session.overallStats[selectedSubject];
    if (!overallSub) return null;

    return session.intervals.map((inv) => {
      const count = overallSub.intervalCounts[inv.id] || 0;
      const pct = overallSub.intervalPercents[inv.id] || 0;
      return {
        label: inv.label,
        count,
        percent: pct,
        color: inv.color || '#6366f1',
      };
    });
  }, [session, selectedSubject]);

  const maxChartCount = useMemo(() => {
    if (!subjectChartData) return 1;
    return Math.max(...subjectChartData.map((d) => d.count), 1);
  }, [subjectChartData]);

  // ==========================================
  // COMPARISON ANALYTICS CALCULATIONS
  // ==========================================

  // Comparison matrix calculations
  const comparisonMatrixData = useMemo(() => {
    return displayClasses.map((cName) => {
      const cs = session.classSummaries[cName];
      const cStudents = session.students.filter((s) => s.className === cName);
      const classAvgTotal = cStudents.length > 0
        ? Math.round((cStudents.reduce((acc, s) => acc + s.averageScore, 0) / cStudents.length) * 100) / 100
        : 0;

      let aboveCount = 0;
      let belowCount = 0;
      let equalCount = 0;

      const subjectDiffs: Record<
        string,
        { classAvg: number; schoolAvg: number; diff: number; diffPercent: number }
      > = {};

      session.subjects.forEach((sub) => {
        const cStat = cs?.subjectStats[sub];
        const sStat = session.overallStats[sub];
        const cAvg = cStat ? cStat.avgScore : 0;
        const sAvg = sStat ? sStat.avgScore : 0;
        const diff = Math.round((cAvg - sAvg) * 100) / 100;
        const diffPercent = sAvg > 0 ? Math.round((diff / sAvg) * 1000) / 10 : 0;

        if (diff > 0.04) aboveCount++;
        else if (diff < -0.04) belowCount++;
        else equalCount++;

        subjectDiffs[sub] = {
          classAvg: cAvg,
          schoolAvg: sAvg,
          diff,
          diffPercent,
        };
      });

      const totalDiff = Math.round((classAvgTotal - schoolTotalAvg) * 100) / 100;

      return {
        className: cName,
        grade: cs?.grade || '',
        studentCount: cs?.studentCount || cStudents.length,
        homeroomTeacher: cs?.homeroomTeacher || 'Chưa cập nhật',
        classAvgTotal,
        totalDiff,
        aboveCount,
        belowCount,
        equalCount,
        subjectDiffs,
      };
    });
  }, [session, displayClasses, schoolTotalAvg]);

  // Ranking classes for a specific subject
  const subjectRankings = useMemo(() => {
    if (!activeCompareSubject) return [];
    const schoolSubStat = session.overallStats[activeCompareSubject];
    const sAvg = schoolSubStat ? schoolSubStat.avgScore : 0;

    return displayClasses
      .map((cName) => {
        const cs = session.classSummaries[cName];
        const cStat = cs?.subjectStats[activeCompareSubject];
        const cAvg = cStat ? cStat.avgScore : 0;
        const diff = Math.round((cAvg - sAvg) * 100) / 100;
        const diffPercent = sAvg > 0 ? Math.round((diff / sAvg) * 1000) / 10 : 0;

        return {
          className: cName,
          grade: cs?.grade || '',
          homeroomTeacher: cs?.homeroomTeacher || '',
          studentCount: cStat?.count || 0,
          classAvg: cAvg,
          schoolAvg: sAvg,
          diff,
          diffPercent,
          maxScore: cStat?.maxScore || 0,
          minScore: cStat?.minScore || 0,
          above5Percent: cStat?.above5Percent || 0,
          above8Percent: cStat?.above8Percent || 0,
        };
      })
      .sort((a, b) => b.classAvg - a.classAvg);
  }, [session, displayClasses, activeCompareSubject]);

  // Overall Top Performer class in comparison
  const topComparisonClass = useMemo(() => {
    if (comparisonMatrixData.length === 0) return null;
    return [...comparisonMatrixData].sort((a, b) => b.totalDiff - a.totalDiff)[0];
  }, [comparisonMatrixData]);

  // Subject with the highest variance/spread across classes
  const subjectWithMaxSpread = useMemo(() => {
    let maxSpread = 0;
    let chosenSub = session.subjects[0] || '';

    session.subjects.forEach((sub) => {
      const avgs = session.classes.map((c) => session.classSummaries[c]?.subjectStats[sub]?.avgScore || 0);
      if (avgs.length > 0) {
        const spread = Math.max(...avgs) - Math.min(...avgs);
        if (spread > maxSpread) {
          maxSpread = spread;
          chosenSub = sub;
        }
      }
    });

    return { subject: chosenSub, spread: Math.round(maxSpread * 100) / 100 };
  }, [session]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>Thống Kê Tiêu Chuẩn & So Sánh Phổ Điểm</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Thống kê điểm trung bình từng môn theo từng lớp so với trường (thấp hơn hay cao hơn bao nhiêu điểm) & phân bổ phổ điểm
          </p>
        </div>

        {/* Action & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope buttons */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewScope('compare_school')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewScope === 'compare_school'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>So Sánh Lớp vs Trường</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-bold">Mới</span>
            </button>

            <button
              onClick={() => setViewScope('school')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScope === 'school'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toàn Trường
            </button>

            <button
              onClick={() => setViewScope('by_class')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScope === 'by_class'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Theo Từng Lớp
            </button>

            <button
              onClick={() => setViewScope('by_subject')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewScope === 'by_subject'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Biểu Đồ Môn Học
            </button>
          </div>

          {/* Export buttons */}
          {viewScope === 'compare_school' ? (
            <button
              onClick={() => exportSubjectComparisonExcel(session)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl transition-all shadow-xs active:scale-98"
              title="Xuất file Excel bảng ma trận so sánh điểm TB từng môn của từng lớp so với trường"
            >
              <Download className="w-4 h-4 text-emerald-100" />
              <span>Xuất Excel So Sánh (.xlsx)</span>
            </button>
          ) : (
            <button
              onClick={() => exportStandardReportExcel(session)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Xuất Bảng Thống Kê (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCOPE 0: SO SÁNH ĐIỂM TRUNG BÌNH TỪNG MÔN THEO LỚP SO VỚI TRƯỜNG (CHÍNH) */}
      {/* ========================================================================= */}
      {viewScope === 'compare_school' && (
        <div className="space-y-6">
          {/* 1. Quick Comparison KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Điểm TB Mốc chuẩn toàn trường */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Mốc Chuẩn Toàn Trường
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900">{schoolTotalAvg.toFixed(2)}</span>
                  <span className="text-xs text-slate-500 font-medium">điểm TB chung</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Khảo sát {session.subjects.length} môn trên {session.students.length} học sinh
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <School className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 2: Lớp có điểm TB vượt trội nhất */}
            <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50 to-white p-4.5 rounded-2xl border border-emerald-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Lớp Dẫn Đầu Vượt Chuẩn</span>
                </div>
                {topComparisonClass ? (
                  <div className="mt-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-slate-900">Lớp {topComparisonClass.className}</span>
                      <span className="inline-flex items-center text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        +{topComparisonClass.totalDiff.toFixed(2)} đ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {topComparisonClass.aboveCount}/{session.subjects.length} môn cao hơn trường | GV: {topComparisonClass.homeroomTeacher}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">Chưa có dữ liệu</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-200">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 3: Môn có độ phân hóa điểm cao nhất */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Phân Hóa Giữa Các Lớp
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-extrabold text-indigo-950">Môn {subjectWithMaxSpread.subject}</span>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    Lệch {subjectWithMaxSpread.spread.toFixed(2)} đ
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Chênh lệch giữa lớp cao nhất & thấp nhất môn này
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ArrowUpDown className="w-6 h-6" />
              </div>
            </div>

            {/* KPI 4: Thống kê số lượng lớp */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quy Mô So Sánh
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-indigo-600">{session.classes.length}</span>
                  <span className="text-xs text-slate-500 font-medium">lớp học / {session.grades.join(', ') || '1 Khối'}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  So sánh trực tiếp điểm TB môn từng lớp với trường
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* 2. Control Bar for Comparison Views */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* View submode tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCompareMode('matrix')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  compareMode === 'matrix'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Ma Trận Tất Cả Các Lớp & Môn
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('by_subject')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  compareMode === 'by_subject'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. So Sánh Xếp Hạng Theo 1 Môn
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('by_class')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  compareMode === 'by_class'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Chi Tiết So Sánh 1 Lớp Cụ Thể
              </button>
            </div>

            {/* Filter Grade & Legend */}
            <div className="flex items-center gap-3">
              {session.grades.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Lọc khối:</span>
                  <select
                    value={selectedGradeFilter}
                    onChange={(e) => setSelectedGradeFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="ALL">Tất cả Khối</option>
                    {session.grades.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Visual Legend */}
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Cao hơn trường (+)
                </span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Thấp hơn trường (-)
                </span>
              </div>
            </div>
          </div>

          {/* 3. Sub-Mode A: MA TRẬN SO SÁNH TỔNG HỢP (Tất cả Lớp x Tất cả Môn) */}
          {compareMode === 'matrix' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Bảng Ma Trận So Sánh Điểm TB Từng Môn Giữa Các Lớp Và Toàn Trường</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mỗi ô hiển thị: <strong>Điểm TB của Lớp</strong> và <strong>Độ lệch so với trường</strong> (Cao hơn (+) hoặc thấp hơn (-) bao nhiêu điểm)
                  </p>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {displayClasses.length} lớp • {session.subjects.length} môn
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 border-b border-slate-300 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-2.5 py-3 text-center sticky left-0 bg-slate-100 z-10 w-12 border-r border-slate-200">
                        STT
                      </th>
                      <th className="px-3.5 py-3 sticky left-12 bg-slate-100 z-10 border-r border-slate-200 min-w-[130px]">
                        Lớp & GVCN
                      </th>
                      <th className="px-2.5 py-3 text-center border-r border-slate-200">
                        Khối
                      </th>
                      <th className="px-2.5 py-3 text-center border-r border-slate-200">
                        Sĩ số
                      </th>

                      {/* Dynamic Subjects */}
                      {session.subjects.map((sub) => {
                        const sStat = session.overallStats[sub];
                        return (
                          <th key={sub} className="px-3 py-2.5 text-center border-r border-slate-200 min-w-[105px]">
                            <div className="text-slate-900 font-bold">{sub}</div>
                            <div className="text-[9.5px] text-indigo-700 font-medium font-mono lowercase tracking-normal">
                              Trường: {sStat ? sStat.avgScore.toFixed(2) : '-'}
                            </div>
                          </th>
                        );
                      })}

                      {/* Total & Summary Evaluation */}
                      <th className="px-3 py-3 text-center bg-indigo-50/70 text-indigo-950 font-extrabold border-r border-indigo-100 min-w-[110px]">
                        ĐTB Chung Lớp
                      </th>
                      <th className="px-3.5 py-3 text-center bg-slate-100 min-w-[140px]">
                        Đánh giá so với trường
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 font-mono">
                    {comparisonMatrixData.map((row, idx) => {
                      const isTop = row.totalDiff > 0.3;
                      const isLow = row.totalDiff < -0.3;

                      return (
                        <tr
                          key={row.className}
                          className={`hover:bg-indigo-50/30 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          {/* STT */}
                          <td className="px-2.5 py-2.5 text-center text-slate-400 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                            {idx + 1}
                          </td>

                          {/* Lớp & GVCN */}
                          <td className="px-3.5 py-2.5 sticky left-12 bg-inherit z-10 border-r border-slate-200 font-sans whitespace-nowrap">
                            <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                              <span>Lớp {row.className}</span>
                              {row.totalDiff > 0.2 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Điểm TB lớp cao hơn trường" />
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                              {row.homeroomTeacher}
                            </div>
                          </td>

                          {/* Khối */}
                          <td className="px-2.5 py-2.5 text-center text-slate-600 font-sans border-r border-slate-200">
                            {row.grade || '-'}
                          </td>

                          {/* Sĩ số */}
                          <td className="px-2.5 py-2.5 text-center text-slate-700 font-bold border-r border-slate-200">
                            {row.studentCount}
                          </td>

                          {/* Subjects Comparison Cells */}
                          {session.subjects.map((sub) => {
                            const diffInfo = row.subjectDiffs[sub];
                            if (!diffInfo) return <td key={sub} className="border-r border-slate-200 text-center">-</td>;

                            const { classAvg, diff, diffPercent } = diffInfo;
                            const isHigher = diff > 0.04;
                            const isLower = diff < -0.04;

                            return (
                              <td
                                key={sub}
                                className={`px-2 py-2 text-center border-r border-slate-200 transition-colors ${
                                  isHigher
                                    ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                                    : isLower
                                    ? 'bg-red-50/30 hover:bg-red-50/60'
                                    : ''
                                }`}
                              >
                                {/* Dòng 1: Điểm TB lớp */}
                                <div className="font-bold text-slate-900 text-xs">
                                  {classAvg.toFixed(2)}
                                </div>

                                {/* Dòng 2: Độ lệch so với trường (+ hoặc - bao nhiêu) */}
                                <div className="mt-0.5">
                                  {isHigher ? (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10.5px] font-extrabold bg-emerald-100 text-emerald-800"
                                      title={`Cao hơn điểm TB trường ${diff.toFixed(2)} điểm (+${diffPercent}%)`}
                                    >
                                      <ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>+{diff.toFixed(2)}</span>
                                    </span>
                                  ) : isLower ? (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10.5px] font-extrabold bg-red-100 text-red-800"
                                      title={`Thấp hơn điểm TB trường ${Math.abs(diff).toFixed(2)} điểm (${diffPercent}%)`}
                                    >
                                      <ArrowDownRight className="w-3 h-3 text-red-600 shrink-0" />
                                      <span>{diff.toFixed(2)}</span>
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10.5px] font-semibold text-slate-500 bg-slate-100"
                                      title="Bằng điểm trung bình toàn trường"
                                    >
                                      <Minus className="w-2.5 h-2.5 text-slate-400" />
                                      <span>0.00</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Total Score & Delta */}
                          <td className="px-3 py-2 text-center bg-indigo-50/30 border-r border-indigo-100">
                            <div className="font-black text-indigo-950 text-xs">
                              {row.classAvgTotal.toFixed(2)}
                            </div>
                            <div className="mt-0.5">
                              {row.totalDiff > 0 ? (
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                                  +{row.totalDiff.toFixed(2)}
                                </span>
                              ) : row.totalDiff < 0 ? (
                                <span className="text-[10px] font-extrabold text-red-700 bg-red-100/80 px-1.5 py-0.2 rounded">
                                  {row.totalDiff.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold">0.00</span>
                              )}
                            </div>
                          </td>

                          {/* Evaluation */}
                          <td className="px-3 py-2 text-center font-sans whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                row.aboveCount >= Math.ceil(session.subjects.length / 2)
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100/80 text-amber-900 border border-amber-200'
                              }`}
                            >
                              <span>{row.aboveCount}/{session.subjects.length} môn vượt trường</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* MỐC CHUẨN TOÀN TRƯỜNG (DÒNG CUỐI CÙNG LÀM MỐC ĐỐI CHIẾU) */}
                    <tr className="bg-slate-900 text-white font-sans font-bold border-t-2 border-indigo-500">
                      <td className="px-2.5 py-3 text-center sticky left-0 bg-slate-900 z-10 text-slate-300">
                        ★
                      </td>
                      <td className="px-3.5 py-3 sticky left-12 bg-slate-900 z-10 text-white font-extrabold uppercase tracking-wider text-xs whitespace-nowrap">
                        MỐC TOÀN TRƯỜNG
                      </td>
                      <td className="px-2.5 py-3 text-center text-slate-300 font-normal">
                        Toàn trường
                      </td>
                      <td className="px-2.5 py-3 text-center text-white font-mono">
                        {session.students.length}
                      </td>

                      {/* School Subject Averages */}
                      {session.subjects.map((sub) => {
                        const sStat = session.overallStats[sub];
                        return (
                          <td key={sub} className="px-2 py-3 text-center bg-slate-950/70 border-r border-slate-800">
                            <div className="font-mono text-sm font-black text-amber-300">
                              {sStat ? sStat.avgScore.toFixed(2) : '-'}
                            </div>
                            <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
                              Điểm chuẩn
                            </div>
                          </td>
                        );
                      })}

                      <td className="px-3 py-3 text-center bg-indigo-950 font-mono text-sm font-black text-white">
                        {schoolTotalAvg.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-300 italic">
                        Mốc đối chiếu chuẩn
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Sub-Mode B: SO SÁNH THEO 1 MÔN CỤ THỂ (Diverging Ranking Bar Chart) */}
          {compareMode === 'by_subject' && (
            <div className="space-y-4">
              {/* Subject selector tabs */}
              <div className="flex flex-wrap items-center gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-600 mr-2 uppercase tracking-wide">
                  Chọn môn so sánh:
                </span>
                {session.subjects.map((sub) => {
                  const sStat = session.overallStats[sub];
                  const isSelected = activeCompareSubject === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setActiveCompareSubject(sub)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>Môn {sub}</span>
                      <span
                        className={`text-[10.5px] px-1.5 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        TB: {sStat ? sStat.avgScore.toFixed(2) : '-'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Subject Benchmark Summary Header */}
              {session.overallStats[activeCompareSubject] && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                      Bảng xếp hạng so sánh điểm TB môn
                    </span>
                    <h3 className="text-xl font-black text-white mt-0.5">
                      Môn {activeCompareSubject} - Điểm Chuẩn Toàn Trường:{' '}
                      <span className="text-amber-300 font-mono">
                        {session.overallStats[activeCompareSubject]?.avgScore.toFixed(2)}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Có <strong>{subjectRankings.filter((r) => r.diff > 0.04).length}</strong> / {subjectRankings.length} lớp đạt điểm trung bình cao hơn điểm trung bình của toàn trường
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-center">
                      <div className="text-[10px] text-slate-300 uppercase font-sans">Cao nhất</div>
                      <div className="text-sm font-bold text-emerald-300">
                        {session.overallStats[activeCompareSubject]?.maxScore.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-center">
                      <div className="text-[10px] text-slate-300 uppercase font-sans">Thấp nhất</div>
                      <div className="text-sm font-bold text-slate-300">
                        {session.overallStats[activeCompareSubject]?.minScore.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-center">
                      <div className="text-[10px] text-slate-300 uppercase font-sans">% Đạt (≥5)</div>
                      <div className="text-sm font-bold text-indigo-200">
                        {session.overallStats[activeCompareSubject]?.above5Percent}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Ranking List with Deviation Progress Bars */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <span>Thứ hạng & Lớp</span>
                  <div className="flex items-center gap-8">
                    <span>Điểm TB Lớp</span>
                    <span className="w-36 text-center">Chênh lệch so với trường</span>
                    <span className="w-28 text-center hidden sm:inline">Tỉ lệ Đạt / Giỏi</span>
                  </div>
                </div>

                {subjectRankings.map((r, rankIdx) => {
                  const isHigher = r.diff > 0.04;
                  const isLower = r.diff < -0.04;
                  const isRank1 = rankIdx === 0;

                  return (
                    <div
                      key={r.className}
                      className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs"
                    >
                      {/* Left: Rank & Class Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs font-mono shrink-0 ${
                            isRank1
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : rankIdx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : rankIdx === 2
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          #{rankIdx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">Lớp {r.className}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                              {r.studentCount} HS
                            </span>
                            {r.grade && (
                              <span className="text-[10px] text-slate-400 font-medium">({r.grade})</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            GVCN: {r.homeroomTeacher || 'Chưa cập nhật'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Scores, Delta & Bars */}
                      <div className="flex items-center gap-6 justify-between sm:justify-end">
                        {/* Class Score */}
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900 font-mono">
                            {r.classAvg.toFixed(2)}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Điểm TB Lớp
                          </span>
                        </div>

                        {/* Delta Badge & Visual bar */}
                        <div className="w-40 text-center space-y-1">
                          <div>
                            {isHigher ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                                <span>+{r.diff.toFixed(2)} ({r.diffPercent > 0 ? '+' : ''}{r.diffPercent}%)</span>
                              </span>
                            ) : isLower ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-200 font-mono">
                                <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />
                                <span>{r.diff.toFixed(2)} ({r.diffPercent}%)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 font-mono">
                                <Minus className="w-3 h-3 text-slate-400" />
                                <span>Bằng trường (0.00)</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-400">
                            {isHigher
                              ? `Cao hơn trường ${r.diff.toFixed(2)} điểm`
                              : isLower
                              ? `Thấp hơn trường ${Math.abs(r.diff).toFixed(2)} điểm`
                              : 'Bằng mức chuẩn trường'}
                          </div>
                        </div>

                        {/* Pass/Excellence Percents */}
                        <div className="w-28 text-right hidden sm:block font-mono">
                          <div className="text-xs font-bold text-slate-700">
                            Đạt: <strong className="text-emerald-700">{r.above5Percent}%</strong>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Giỏi: <strong className="text-blue-700">{r.above8Percent}%</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Sub-Mode C: SO SÁNH CHI TIẾT 1 LỚP CỤ THỂ */}
          {compareMode === 'by_class' && (
            <div className="space-y-4">
              {/* Class selector */}
              <div className="flex flex-wrap items-center gap-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-600 mr-2 uppercase tracking-wide">
                  Chọn lớp phân tích:
                </span>
                {session.classes.map((cName) => {
                  const isSelected = activeCompareClass === cName;
                  const count = session.students.filter((s) => s.className === cName).length;
                  return (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => setActiveCompareClass(cName)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>Lớp {cName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {count} HS
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Class Summary Banner */}
              {session.classSummaries[activeCompareClass] && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-700">
                          Khối {session.classSummaries[activeCompareClass]?.grade || '10'}
                        </span>
                        <h4 className="text-lg font-black text-slate-900">
                          Chi Tiết So Sánh Điểm TB Các Môn Lớp {activeCompareClass} So Với Trường
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        GVCN: <strong>{session.classSummaries[activeCompareClass]?.homeroomTeacher}</strong> | Sĩ số:{' '}
                        <strong>{session.students.filter((s) => s.className === activeCompareClass).length}</strong> học sinh
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-100 text-center">
                        <div className="text-[10px] text-indigo-600 font-bold uppercase">Điểm TB Lớp</div>
                        <div className="text-base font-black text-indigo-950 font-mono">
                          {session.classSummaries[activeCompareClass]?.avgTotalScore}
                        </div>
                      </div>
                      <div className="bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 text-center">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Điểm TB Trường</div>
                        <div className="text-base font-black text-slate-800 font-mono">
                          {schoolTotalAvg.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table of subjects for this class */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10.5px]">
                        <tr>
                          <th className="px-4 py-3">Môn học</th>
                          <th className="px-3 py-3 text-center">Số bài thi</th>
                          <th className="px-3.5 py-3 text-center bg-indigo-50/50 text-indigo-950 font-extrabold">
                            Điểm TB Lớp {activeCompareClass}
                          </th>
                          <th className="px-3.5 py-3 text-center bg-slate-100 text-slate-800 font-bold">
                            Điểm TB Trường (Chuẩn)
                          </th>
                          <th className="px-4 py-3 text-center font-extrabold text-slate-900">
                            Độ lệch so với trường (±)
                          </th>
                          <th className="px-3 py-3 text-center">Max / Min Lớp</th>
                          <th className="px-3 py-3 text-center bg-emerald-50/50 text-emerald-900">
                            % Đạt (≥5) Lớp vs Trường
                          </th>
                          <th className="px-3.5 py-3 text-center">Đánh giá chuyên môn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {session.subjects.map((sub) => {
                          const cStat = session.classSummaries[activeCompareClass]?.subjectStats[sub];
                          const sStat = session.overallStats[sub];
                          if (!cStat || !sStat) return null;

                          const diff = Math.round((cStat.avgScore - sStat.avgScore) * 100) / 100;
                          const diffPercent = sStat.avgScore > 0 ? Math.round((diff / sStat.avgScore) * 1000) / 10 : 0;
                          const isHigher = diff > 0.04;
                          const isLower = diff < -0.04;

                          return (
                            <tr key={sub} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-sans font-bold text-slate-900 text-xs">
                                {sub}
                              </td>
                              <td className="px-3 py-3 text-center text-slate-600 font-mono">
                                {cStat.count}
                              </td>

                              {/* Class Score */}
                              <td className="px-3.5 py-3 text-center font-black text-indigo-900 bg-indigo-50/30 text-xs">
                                {cStat.avgScore.toFixed(2)}
                              </td>

                              {/* School Score */}
                              <td className="px-3.5 py-3 text-center font-bold text-slate-700 bg-slate-50">
                                {sStat.avgScore.toFixed(2)}
                              </td>

                              {/* Difference Badge */}
                              <td className="px-4 py-3 text-center">
                                {isHigher ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>+{diff.toFixed(2)} (Cao hơn {diffPercent}%)</span>
                                  </span>
                                ) : isLower ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200">
                                    <ArrowDownRight className="w-3.5 h-3.5 text-red-600" />
                                    <span>{diff.toFixed(2)} (Thấp hơn {Math.abs(diffPercent)}%)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                    <Minus className="w-3 h-3 text-slate-400" />
                                    <span>Bằng trường (0.00)</span>
                                  </span>
                                )}
                              </td>

                              {/* Max / Min */}
                              <td className="px-3 py-3 text-center text-xs">
                                <span className="font-bold text-emerald-600">{cStat.maxScore.toFixed(1)}</span>
                                <span className="text-slate-300 mx-1">/</span>
                                <span className="text-slate-500">{cStat.minScore.toFixed(1)}</span>
                              </td>

                              {/* Pass % vs School Pass % */}
                              <td className="px-3 py-3 text-center bg-emerald-50/20 text-xs font-sans">
                                <strong className="text-emerald-700">{cStat.above5Percent}%</strong>
                                <span className="text-slate-400 text-[11px] block">
                                  Trường: {sStat.above5Percent}%
                                </span>
                              </td>

                              {/* Pedagogical Note */}
                              <td className="px-3.5 py-3 text-center font-sans">
                                {isHigher ? (
                                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                    ✓ Vượt chuẩn trường
                                  </span>
                                ) : isLower ? (
                                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                    ⚠ Cần tăng cường ôn tập
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                                    Đạt mức trung bình
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCOPE 1: TOÀN TRƯỜNG */}
      {/* ========================================================================= */}
      {viewScope === 'school' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Thống kê phổ điểm các môn - Quy mô Toàn trường ({session.students.length} học sinh)
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {session.intervals.length} mốc tiêu chuẩn
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="px-4 py-3 sticky left-0 bg-slate-50">Môn học</th>
                    <th className="px-3 py-3 text-center">Số bài</th>
                    <th className="px-3 py-3 text-center bg-indigo-50/40 text-indigo-900">Điểm TB</th>
                    <th className="px-3 py-3 text-center">Max</th>
                    <th className="px-3 py-3 text-center">Min</th>

                    {/* Dynamic Intervals */}
                    {session.intervals.map((inv) => (
                      <th key={inv.id} className="px-3 py-3 text-center min-w-[70px]">
                        {inv.label}
                      </th>
                    ))}

                    <th className="px-3.5 py-3 text-center bg-emerald-50/40 text-emerald-900">
                      Đạt (≥5.0)
                    </th>
                    <th className="px-3.5 py-3 text-center bg-blue-50/40 text-blue-900">
                      Giỏi (≥8.0)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {session.subjects.map((sub) => {
                    const st = session.overallStats[sub];
                    if (!st) return null;

                    return (
                      <tr key={sub} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-sans font-bold text-slate-900 sticky left-0 bg-white whitespace-nowrap">
                          {sub}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-600">{st.count}</td>
                        <td className="px-3 py-3 text-center font-bold text-indigo-700 bg-indigo-50/30">
                          {st.avgScore.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-600">
                          {st.maxScore.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500">
                          {st.minScore.toFixed(1)}
                        </td>

                        {/* Interval counts and percents */}
                        {session.intervals.map((inv) => {
                          const count = st.intervalCounts[inv.id] || 0;
                          const pct = st.intervalPercents[inv.id] || 0;
                          return (
                            <td key={inv.id} className="px-2.5 py-2.5 text-center">
                              <div className="font-bold text-slate-800">{count}</div>
                              <div className="text-[10px] text-slate-400 font-sans">{pct}%</div>
                              {/* Mini progress indicator */}
                              <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, pct * 2)}%`,
                                    backgroundColor: inv.color || '#6366f1',
                                  }}
                                />
                              </div>
                            </td>
                          );
                        })}

                        {/* Above 5.0 */}
                        <td className="px-3 py-3 text-center bg-emerald-50/20 whitespace-nowrap">
                          <span className="font-bold text-emerald-700">{st.above5Count}</span>
                          <span className="text-[10px] text-emerald-600 block font-sans font-semibold">
                            {st.above5Percent}%
                          </span>
                        </td>

                        {/* Above 8.0 */}
                        <td className="px-3 py-3 text-center bg-blue-50/20 whitespace-nowrap">
                          <span className="font-bold text-blue-700">{st.above8Count}</span>
                          <span className="text-[10px] text-blue-600 block font-sans font-semibold">
                            {st.above8Percent}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCOPE 2: THEO TỪNG LỚP (BỔ SUNG THÊM CỘT SO SÁNH VỚI TRƯỜNG) */}
      {/* ========================================================================= */}
      {viewScope === 'by_class' && (
        <div className="space-y-4">
          {/* Class selector */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-bold text-slate-600 mr-2">Chọn lớp xem:</span>
            {session.classes.map((cName) => (
              <button
                key={cName}
                onClick={() => setSelectedClass(cName)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedClass === cName
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Lớp {cName}
              </button>
            ))}
          </div>

          {activeClassStats && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-indigo-50/40 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-sm text-indigo-950">
                    Thống Kê Điểm Lớp {selectedClass} ({activeClassStats.grade})
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    GV Chủ Nhiệm: <strong>{activeClassStats.homeroomTeacher}</strong> | Sĩ số:{' '}
                    <strong>{activeClassStats.studentCount}</strong> học sinh | Điểm TB lớp:{' '}
                    <strong>{activeClassStats.avgTotalScore}</strong>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3 sticky left-0 bg-slate-50">Môn học</th>
                      <th className="px-3 py-3 text-center">Số bài</th>
                      <th className="px-3 py-3 text-center bg-indigo-50/40 text-indigo-900">Điểm TB Lớp</th>
                      {/* Thêm cột so sánh với trường trực tiếp */}
                      <th className="px-3 py-3 text-center bg-slate-100 text-slate-700">Điểm TB Trường</th>
                      <th className="px-3.5 py-3 text-center bg-emerald-50/60 text-emerald-950 font-extrabold">
                        So với Trường (±)
                      </th>
                      <th className="px-3 py-3 text-center">Max</th>
                      <th className="px-3 py-3 text-center">Min</th>

                      {session.intervals.map((inv) => (
                        <th key={inv.id} className="px-3 py-3 text-center min-w-[70px]">
                          {inv.label}
                        </th>
                      ))}

                      <th className="px-3.5 py-3 text-center bg-emerald-50/40 text-emerald-900">
                        Đạt (≥5.0)
                      </th>
                      <th className="px-3.5 py-3 text-center bg-blue-50/40 text-blue-900">
                        Giỏi (≥8.0)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {session.subjects.map((sub) => {
                      const st = activeClassStats.subjectStats[sub];
                      const schoolSt = session.overallStats[sub];
                      if (!st) return null;

                      const diff = schoolSt ? Math.round((st.avgScore - schoolSt.avgScore) * 100) / 100 : 0;
                      const isHigher = diff > 0.04;
                      const isLower = diff < -0.04;

                      return (
                        <tr key={sub} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-sans font-bold text-slate-900 sticky left-0 bg-white whitespace-nowrap">
                            {sub}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-600">{st.count}</td>
                          <td className="px-3 py-3 text-center font-bold text-indigo-700 bg-indigo-50/30">
                            {st.avgScore.toFixed(2)}
                          </td>

                          {/* Điểm TB trường */}
                          <td className="px-3 py-3 text-center text-slate-700 bg-slate-50 font-bold">
                            {schoolSt ? schoolSt.avgScore.toFixed(2) : '-'}
                          </td>

                          {/* So với trường */}
                          <td className="px-3.5 py-3 text-center bg-emerald-50/20 whitespace-nowrap">
                            {isHigher ? (
                              <span className="inline-flex items-center gap-0.5 text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                +{diff.toFixed(2)}
                              </span>
                            ) : isLower ? (
                              <span className="inline-flex items-center gap-0.5 text-xs font-black text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                {diff.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 font-semibold">0.00</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-emerald-600">
                            {st.maxScore.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-500">
                            {st.minScore.toFixed(1)}
                          </td>

                          {session.intervals.map((inv) => {
                            const count = st.intervalCounts[inv.id] || 0;
                            const pct = st.intervalPercents[inv.id] || 0;
                            return (
                              <td key={inv.id} className="px-2.5 py-2.5 text-center">
                                <div className="font-bold text-slate-800">{count}</div>
                                <div className="text-[10px] text-slate-400 font-sans">{pct}%</div>
                                <div className="w-full bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, pct * 2)}%`,
                                      backgroundColor: inv.color || '#6366f1',
                                    }}
                                  />
                                </div>
                              </td>
                            );
                          })}

                          <td className="px-3 py-3 text-center bg-emerald-50/20 whitespace-nowrap">
                            <span className="font-bold text-emerald-700">{st.above5Count}</span>
                            <span className="text-[10px] text-emerald-600 block font-sans font-semibold">
                              {st.above5Percent}%
                            </span>
                          </td>

                          <td className="px-3 py-3 text-center bg-blue-50/20 whitespace-nowrap">
                            <span className="font-bold text-blue-700">{st.above8Count}</span>
                            <span className="text-[10px] text-blue-600 block font-sans font-semibold">
                              {st.above8Percent}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCOPE 3: BIỂU ĐỒ PHỔ ĐIỂM MÔN HỌC */}
      {/* ========================================================================= */}
      {viewScope === 'by_subject' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-bold text-slate-600 mr-2">Chọn môn phân tích:</span>
            {session.subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedSubject === sub
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Môn {sub}
              </button>
            ))}
          </div>

          {subjectChartData && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Phổ Điểm Môn {selectedSubject} (Toàn Trường)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Biểu đồ phân phối số lượng bài thi theo từng mốc điểm
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                  <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    Điểm TB: <strong className="text-indigo-600">{session.overallStats[selectedSubject]?.avgScore}</strong>
                  </div>
                  <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    Max: <strong className="text-emerald-600">{session.overallStats[selectedSubject]?.maxScore}</strong>
                  </div>
                  <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    Min: <strong className="text-slate-600">{session.overallStats[selectedSubject]?.minScore}</strong>
                  </div>
                </div>
              </div>

              {/* Bar Chart Visualization */}
              <div className="pt-4 pb-2">
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 items-end h-64 border-b border-slate-200 px-2 pb-2">
                  {subjectChartData.map((d, i) => {
                    const barHeightPct = maxChartCount > 0 ? (d.count / maxChartCount) * 100 : 0;

                    return (
                      <div key={i} className="flex flex-col items-center h-full justify-end group">
                        <span className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-600 mb-1 font-mono">
                          {d.count}
                        </span>
                        <div className="w-full max-w-[40px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-48">
                          <div
                            className="w-full transition-all duration-500 rounded-t-lg group-hover:brightness-110"
                            style={{
                              height: `${Math.max(barHeightPct, 4)}%`,
                              backgroundColor: d.color,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium mt-2 text-center line-clamp-1 w-full" title={d.label}>
                          {d.label}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {d.percent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
