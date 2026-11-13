import React, { useState, useMemo } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Download,
  UserCheck,
  CheckCircle2,
  Edit3,
  Save,
  Sparkles,
  School,
  FileText,
  Settings2
} from 'lucide-react';
import { StatisticSession, Student } from '../types';
import { updateSession } from '../services/storage';
import { PrintConfigModal } from './PrintConfigModal';

import { exportSingleClassWorkbook } from '../services/excelService';

interface ClassReportTabProps {
  session: StatisticSession;
  onUpdateSession: (updated: StatisticSession) => void;
  onExportMultiSheet: () => void;
  onOpenExportPrintModal?: (targetClass?: string) => void;
  onOpenGradeSlipModal?: (targetClass?: string, targetStudentId?: string) => void;
}

export const ClassReportTab: React.FC<ClassReportTabProps> = ({
  session,
  onUpdateSession,
  onExportMultiSheet,
  onOpenExportPrintModal,
  onOpenGradeSlipModal,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(session.classes[0] || '');
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [teacherNameInput, setTeacherNameInput] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const classSummary = useMemo(() => {
    return session.classSummaries[selectedClass] || null;
  }, [session, selectedClass]);

  const classStudents = useMemo(() => {
    return session.students
      .filter((s) => s.className === selectedClass)
      .sort((a, b) => a.classRank - b.classRank);
  }, [session, selectedClass]);

  const handleStartEditTeacher = () => {
    setTeacherNameInput(classSummary?.homeroomTeacher || '');
    setIsEditingTeacher(true);
  };

  const handleSaveTeacher = async () => {
    if (!classSummary) return;

    const updatedSummaries = {
      ...session.classSummaries,
      [selectedClass]: {
        ...classSummary,
        homeroomTeacher: teacherNameInput.trim() || '',
      },
    };

    const updatedSession: StatisticSession = {
      ...session,
      classSummaries: updatedSummaries,
    };

    await updateSession(updatedSession);
    onUpdateSession(updatedSession);
    setIsEditingTeacher(false);
  };

  const handleOpenPrintDialog = () => {
    if (onOpenExportPrintModal) {
      onOpenExportPrintModal(selectedClass);
    } else {
      setIsPrintModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Class Switcher & Action Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 print:hidden">
        {/* Class Selection Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Chọn Lớp:
          </span>
          {session.classes.map((cName) => {
            const count = session.students.filter((s) => s.className === cName).length;
            const isSelected = selectedClass === cName;

            return (
              <button
                key={cName}
                onClick={() => {
                  setSelectedClass(cName);
                  setIsEditingTeacher(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <span>Lớp {cName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count} HS
                </span>
              </button>
            );
          })}
        </div>

        {/* Print & Export Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Nút: Tùy chỉnh & và in báo cáo */}
          <button
            onClick={handleOpenPrintDialog}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-98"
            title="Tùy chỉnh chọn cột, hướng giấy in, tiêu chuẩn thống kê, xem trước bản in và thực hiện in báo cáo ra máy in"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            <span>Tùy chỉnh & in báo cáo</span>
          </button>

          {/* Nút 3: Xuất file Excel chuẩn in riêng cho lớp đang chọn */}
          <button
            onClick={() => handleOpenPrintDialog()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-98"
            title="Cấu hình và tải tệp Excel lớp này đã được kẻ viền ô, căn chỉnh vừa khít trang in A4 và tiêu đề căn giữa"
          >
            <Download className="w-4 h-4 text-indigo-200" />
            <span>Xuất Excel Lớp Này</span>
          </button>

          {/* Nút 4: Xuất danh sách điểm thi (Tất cả các lớp chuẩn trang in) */}
          <button
            onClick={onExportMultiSheet}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-98"
            title="Xuất danh sách điểm thi chuẩn trang in gồm Sheet 1 tổng hợp và các sheet riêng từng lớp"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Xuất danh sách điểm thi</span>
          </button>

          {/* Nút 5: In phiếu báo điểm học sinh (In trực tiếp / Xuất file Word .docx) */}
          {onOpenGradeSlipModal && (
            <button
              onClick={() => onOpenGradeSlipModal(selectedClass)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-98"
              title="In phiếu báo điểm từng học sinh hoặc xuất file Word (.docx) mỗi em 1 trang"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>In Phiếu Báo Điểm Học Sinh</span>
            </button>
          )}
        </div>
      </div>

      {/* Sheet Simulation Container (Print-optimized A4 Page Layout) */}
      <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl border border-slate-200 overflow-x-auto print:bg-white print:p-0 print:border-none">
        <div className="bg-white shadow-xl mx-auto rounded-xl p-6 sm:p-10 text-slate-900 print:shadow-none print:p-2 print:rounded-none max-w-6xl min-w-[850px] print:min-w-full print:max-w-none text-xs">
          
          {/* 1. Header Báo cáo Quốc hiệu & Trường */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-300">
            <div className="text-center w-[42%] font-sans">
              <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                SỞ GIÁO DỤC VÀ ĐÀO TẠO
              </p>
              <p className="font-extrabold text-slate-950 uppercase text-xs mt-0.5">
                {session.schoolName.trim().toUpperCase().startsWith('TRƯỜNG:') ? session.schoolName.trim().toUpperCase() : `TRƯỜNG: ${session.schoolName.trim().toUpperCase()}`}
              </p>
              <p className="text-[10px] text-slate-500 italic mt-0.5 font-serif">
                Đơn vị lưu trữ hồ sơ khảo sát
              </p>
            </div>
            <div className="text-center w-[50%] font-sans">
              <p className="font-extrabold text-slate-950 uppercase tracking-wider text-[11px]">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
              </p>
              <p className="font-medium text-slate-800 italic text-[11px] mt-0.5">
                Độc lập - Tự do - Hạnh phúc
              </p>
              <div className="w-24 h-0.5 bg-slate-500 mx-auto mt-1" />
            </div>
          </div>

          {/* 2. Main Title */}
          <div className="text-center my-5 space-y-1">
            <h2 className="text-base sm:text-lg font-extrabold text-indigo-950 uppercase tracking-wide">
              BẢNG KẾT QUẢ ĐIỂM & THỐNG KÊ CHI TIẾT - LỚP {selectedClass}
            </h2>
            <p className="text-xs text-slate-600 font-semibold">
              Kỳ thi: <span className="text-slate-900">{session.name}</span> | Năm học: {session.academicYear}
            </p>
          </div>

          {/* 3. Class & Teacher Metadata Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500 font-medium">Giáo viên chủ nhiệm: </span>
                {isEditingTeacher ? (
                  <div className="inline-flex items-center gap-1.5 ml-1">
                    <input
                      type="text"
                      value={teacherNameInput}
                      onChange={(e) => setTeacherNameInput(e.target.value)}
                      className="px-2 py-0.5 text-xs font-bold border border-indigo-400 rounded focus:outline-none"
                    />
                    <button
                      onClick={handleSaveTeacher}
                      className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[11px] font-semibold"
                    >
                      Lưu
                    </button>
                  </div>
                ) : (
                  <span className="font-bold text-slate-900">
                    {classSummary?.homeroomTeacher && !classSummary.homeroomTeacher.includes('Chủ Nhiệm') ? classSummary.homeroomTeacher : 'Chưa cập nhật'}
                    <button
                      onClick={handleStartEditTeacher}
                      className="ml-2 text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold print:hidden"
                      title="Chỉnh sửa tên GVCN"
                    >
                      [Sửa]
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
              <div>
                Sĩ số: <span className="font-extrabold text-slate-900">{classStudents.length}</span> học sinh
              </div>
              <div>
                Điểm TB lớp: <span className="font-extrabold text-indigo-700">{classSummary?.avgTotalScore}</span>
              </div>
              <div>
                Khối: <span className="font-bold text-slate-800">{classSummary?.grade}</span>
              </div>
            </div>
          </div>

          {/* 4. PHẦN I: BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN CỦA LỚP */}
          <div className="mb-6 space-y-2">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN CỦA LỚP</span>
            </h3>

            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100/80 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Môn học</th>
                    <th className="px-2 py-2 text-center">Số bài</th>
                    <th className="px-2 py-2 text-center bg-indigo-50/50">Điểm TB</th>
                    <th className="px-2 py-2 text-center">Max</th>
                    <th className="px-2 py-2 text-center">Min</th>

                    {session.intervals.map((inv) => (
                      <th key={inv.id} className="px-2 py-2 text-center min-w-[55px]">
                        {inv.label}
                      </th>
                    ))}

                    <th className="px-2 py-2 text-center bg-emerald-50/50">Đạt (≥5)</th>
                    <th className="px-2 py-2 text-center bg-emerald-50/50">% Đạt</th>
                    <th className="px-2 py-2 text-center bg-blue-50/50">Giỏi (≥8)</th>
                    <th className="px-2 py-2 text-center bg-blue-50/50">% Giỏi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {session.subjects.map((sub) => {
                    const st = classSummary?.subjectStats[sub];
                    if (!st) return null;

                    return (
                      <tr key={sub} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-sans font-bold text-slate-900">{sub}</td>
                        <td className="px-2 py-1.5 text-center text-slate-600">{st.count}</td>
                        <td className="px-2 py-1.5 text-center font-bold text-indigo-700 bg-indigo-50/20">
                          {st.avgScore.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold text-emerald-600">{st.maxScore.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500">{st.minScore.toFixed(1)}</td>

                        {session.intervals.map((inv) => (
                          <td key={inv.id} className="px-1.5 py-1.5 text-center">
                            <span className="font-bold text-slate-800">{st.intervalCounts[inv.id] || 0}</span>
                            <span className="text-[9px] text-slate-400 block font-sans">
                              {st.intervalPercents[inv.id] || 0}%
                            </span>
                          </td>
                        ))}

                        <td className="px-2 py-1.5 text-center bg-emerald-50/20 font-bold text-emerald-700">{st.above5Count}</td>
                        <td className="px-2 py-1.5 text-center bg-emerald-50/20 font-sans font-semibold text-emerald-700">{st.above5Percent}%</td>
                        <td className="px-2 py-1.5 text-center bg-blue-50/20 font-bold text-blue-700">{st.above8Count}</td>
                        <td className="px-2 py-1.5 text-center bg-blue-50/20 font-sans font-semibold text-blue-700">{st.above8Percent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. PHẦN II: DANH SÁCH CHI TIẾT HỌC SINH CỦA LỚP */}
          <div className="mb-6 space-y-2">
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              II. DANH SÁCH CHI TIẾT HỌC SINH LỚP {selectedClass} (CÓ XẾP THỨ LỚP & TRƯỜNG)
            </h3>

            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100/80 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-2 py-2 text-center">STT</th>
                    <th className="px-2 py-2 text-center">SBD</th>
                    {classStudents.some((s) => s.soPhach) && (
                      <th className="px-2 py-2 text-center bg-indigo-50/50 text-indigo-900">Số phách</th>
                    )}
                    <th className="px-3 py-2">Họ và Tên</th>
                    <th className="px-2 py-2 text-center">Ngày sinh</th>
                    {classStudents.some((s) => s.examRoom) && (
                      <th className="px-2 py-2 text-center">Phòng thi</th>
                    )}
                    <th className="px-1.5 py-2 text-center">GT</th>

                    {session.subjects.map((sub) => (
                      <th key={sub} className="px-2 py-2 text-center">{sub}</th>
                    ))}

                    <th className="px-2.5 py-2 text-right bg-indigo-50/50 text-indigo-900">Tổng điểm</th>
                    <th className="px-2 py-2 text-right bg-slate-100">Điểm TB</th>
                    <th className="px-2.5 py-2 text-center bg-emerald-50 text-emerald-900">Thứ Lớp</th>
                    <th className="px-2.5 py-2 text-center bg-amber-50 text-amber-900">Thứ Trường</th>
                    {onOpenGradeSlipModal && (
                      <th className="px-2 py-2 text-center print:hidden bg-blue-50/60 text-blue-900">Phiếu điểm</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {classStudents.map((st, idx) => (
                    <tr key={st.id} className="hover:bg-slate-50 font-mono">
                      <td className="px-2 py-1.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-700">{st.sbd}</td>
                      {classStudents.some((s) => s.soPhach) && (
                        <td className="px-2 py-1.5 text-center font-semibold text-indigo-700">{st.soPhach || '-'}</td>
                      )}
                      <td className="px-3 py-1.5 font-sans font-bold text-slate-900 whitespace-nowrap">
                        {st.name}
                      </td>
                      <td className="px-2 py-1.5 text-center text-slate-500 font-sans">{st.dob || '-'}</td>
                      {classStudents.some((s) => s.examRoom) && (
                        <td className="px-2 py-1.5 text-center text-slate-700 font-bold">{st.examRoom || '-'}</td>
                      )}
                      <td className="px-1.5 py-1.5 text-center text-slate-400 font-sans">{st.gender || '-'}</td>

                      {session.subjects.map((sub) => {
                        const sc = st.scores[sub];
                        const isNull = sc === null || sc === undefined;
                        const isLow = typeof sc === 'number' && sc < 5.0;
                        const isHigh = typeof sc === 'number' && sc >= 8.0;

                        return (
                          <td
                            key={sub}
                            className={`px-2 py-1.5 text-center ${
                              isNull ? 'text-slate-300' : isLow ? 'text-red-600 font-bold' : isHigh ? 'text-emerald-700 font-bold' : 'text-slate-800'
                            }`}
                          >
                            {isNull ? '-' : sc.toFixed(1)}
                          </td>
                        );
                      })}

                      <td className="px-2.5 py-1.5 text-right font-bold text-indigo-700 bg-indigo-50/20">
                        {st.totalScore.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-slate-700">
                        {st.averageScore.toFixed(2)}
                      </td>
                      <td className="px-2.5 py-1.5 text-center font-extrabold text-emerald-800 bg-emerald-50/30">
                        #{st.classRank}
                      </td>
                      <td className="px-2.5 py-1.5 text-center font-bold text-amber-800 bg-amber-50/30">
                        #{st.schoolRank}
                      </td>
                      {onOpenGradeSlipModal && (
                        <td className="px-2 py-1 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => onOpenGradeSlipModal(selectedClass, st.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-sans font-bold text-[10.5px] rounded-md transition-colors border border-blue-200 shadow-2xs"
                            title={`Xem, in hoặc xuất Word phiếu báo điểm của em ${st.name}`}
                          >
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Phiếu</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Chữ ký chuẩn văn bản hành chính giáo dục */}
          <div className="pt-6 pb-4">
            <div className="flex justify-end pr-10 text-slate-600 italic text-[11px] mb-3">
              Ngày ..... tháng ..... năm 20....
            </div>
            <div className="grid grid-cols-3 gap-4 text-center font-sans text-xs">
              <div>
                <p className="font-bold text-slate-900 uppercase">GIÁO VIÊN BỘ MÔN</p>
                <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                <div className="h-20" />
              </div>
              <div>
                <p className="font-bold text-slate-900 uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
                <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                <div className="h-20 flex items-end justify-center font-bold text-slate-800 text-xs">
                  {classSummary?.homeroomTeacher && !classSummary.homeroomTeacher.includes('Chủ Nhiệm') ? classSummary.homeroomTeacher : ''}
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-900 uppercase">BAN GIÁM HIỆU</p>
                <p className="text-[10px] text-slate-400 italic mt-0.5">(Ký, đóng dấu)</p>
                <div className="h-20" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Configuration Modal */}
      <PrintConfigModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        session={session}
        selectedClass={selectedClass}
      />
    </div>
  );
};
