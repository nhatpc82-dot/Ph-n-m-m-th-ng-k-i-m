import React, { useState, useEffect } from 'react';
import {
  Trophy,
  BarChart3,
  FileSpreadsheet,
  Download,
  PlusCircle,
  FileText,
  School,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Edit3
} from 'lucide-react';
import { StatisticSession } from './types';
import { createInitialSampleSession } from './services/sampleData';
import { getAllSessions, saveSession, deleteSession } from './services/storage';
import { exportMultiSheetWorkbook, exportStandardReportExcel } from './services/excelService';

import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { CriteriaStatsTab } from './components/CriteriaStatsTab';
import { ClassReportTab } from './components/ClassReportTab';
import { NewStatModal } from './components/NewStatModal';
import { TemplateModal } from './components/TemplateModal';
import { HistoryModal } from './components/HistoryModal';
import { ExportPrintModal } from './components/ExportPrintModal';
import { GradeSlipModal } from './components/GradeSlipModal';
import { EditStatModal } from './components/EditStatModal';

export default function App() {
  const [savedSessions, setSavedSessions] = useState<StatisticSession[]>([]);
  const [currentSession, setCurrentSession] = useState<StatisticSession | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'criteria' | 'classes'>('overview');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isExportPrintModalOpen, setIsExportPrintModalOpen] = useState(false);
  const [exportModalInitialClass, setExportModalInitialClass] = useState<string | undefined>(undefined);

  // Grade Slip Modal state
  const [isGradeSlipModalOpen, setIsGradeSlipModalOpen] = useState(false);
  const [gradeSlipInitialClass, setGradeSlipInitialClass] = useState<string | undefined>(undefined);
  const [gradeSlipInitialStudentId, setGradeSlipInitialStudentId] = useState<string | undefined>(undefined);

  // Edit Stat Session Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Success toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Export / Print dialog with live preview
  const handleOpenExportPrint = (targetClass?: string) => {
    setExportModalInitialClass(targetClass);
    setIsExportPrintModalOpen(true);
  };

  // Open Grade Slip (Phiếu báo điểm học sinh) dialog with live preview and Word export
  const handleOpenGradeSlip = (targetClass?: string, targetStudentId?: string) => {
    setGradeSlipInitialClass(targetClass);
    setGradeSlipInitialStudentId(targetStudentId);
    setIsGradeSlipModalOpen(true);
  };

  // Load persistent sessions from IndexedDB on startup
  const reloadSessions = async () => {
    try {
      const list = await getAllSessions();

      // Nâng cấp dữ liệu mẫu cũ sang chuẩn Trường THCS Thư Vũ (169 học sinh, 5 lớp)
      if (
        list.length === 1 &&
        (list[0].schoolName.includes('Chu Văn An') || list[0].fileName === 'Mau_Nhap_Diem_Kiem_Tra.xlsx')
      ) {
        const initial = createInitialSampleSession();
        await deleteSession(list[0].id);
        await saveSession(initial);
        localStorage.setItem('edustat_initialized_thu_vu_169', 'true');
        setSavedSessions([initial]);
        setCurrentSession(initial);
        return;
      }

      if (list.length > 0) {
        setSavedSessions(list);
        if (!currentSession || !list.some((s) => s.id === currentSession.id)) {
          setCurrentSession(list[0]);
        }
      } else {
        // Chỉ nạp dữ liệu mẫu tự động LẦN ĐẦU TIÊN DUY NHẤT khi người dùng mở trang lần đầu
        const hasInitialized = localStorage.getItem('edustat_initialized_thu_vu_169');
        if (!hasInitialized) {
          const initial = createInitialSampleSession();
          await saveSession(initial);
          localStorage.setItem('edustat_initialized_thu_vu_169', 'true');
          setSavedSessions([initial]);
          setCurrentSession(initial);
        } else {
          // Người dùng đã chủ động xóa hết các đợt thống kê:
          // Tôn trọng lệnh xóa, để danh sách trống, KHÔNG tự ý tạo lại dữ liệu mẫu!
          setSavedSessions([]);
          setCurrentSession(null);
        }
      }
    } catch (e) {
      console.error('Failed to load sessions from IndexedDB', e);
      setSavedSessions([]);
      setCurrentSession(null);
    }
  };

  useEffect(() => {
    reloadSessions();
  }, []);

  const handleSessionCreated = (newSession: StatisticSession) => {
    setCurrentSession(newSession);
    reloadSessions();
    showToast(`Đã hoàn tất thống kê "${newSession.name}" và tự động tách ${newSession.classes.length} lớp!`);
  };

  const handleExportMultiSheet = () => {
    if (!currentSession) return;
    handleOpenExportPrint();
  };

  const handleExportSummary = () => {
    if (!currentSession) return;
    exportStandardReportExcel(currentSession);
    showToast('Đang tải file thống kê tiêu chuẩn...');
  };

  const handleLoadSampleDirectly = async () => {
    const sample = createInitialSampleSession();
    await saveSession(sample);
    localStorage.setItem('edustat_initialized_thu_vu_169', 'true');
    await reloadSessions();
    setCurrentSession(sample);
    showToast('Đã nạp thành công dữ liệu mẫu 169 học sinh (5 lớp) Trường THCS Thư Vũ!');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Main Header */}
      <Header
        currentSession={currentSession}
        savedSessions={savedSessions}
        onSelectSession={(s) => {
          setCurrentSession(s);
          showToast(`Đã chuyển sang đợt "${s.name}"`);
        }}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onOpenTemplatesModal={() => setIsTemplatesModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onExportMultiSheet={() => handleOpenExportPrint()}
        onExportSummary={handleExportSummary}
        onOpenGradeSlipModal={() => handleOpenGradeSlip()}
      />

      {/* 2. Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {currentSession ? (
          <>
            {/* Session Info Bar & Tabs Navigation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                      {currentSession.schoolName}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-semibold text-slate-500">
                      Năm học: {currentSession.academicYear}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {currentSession.name}
                  </h1>
                </div>

                {/* Primary Quick Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Nút 1: In phiếu báo điểm học sinh (Chuẩn Bộ GD&ĐT & Xuất Word .docx) */}
                  <button
                    onClick={() => handleOpenGradeSlip()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-98"
                    title="In trực tiếp phiếu báo điểm từng học sinh hoặc xuất file Word (.docx) mỗi em 1 trang theo lớp"
                  >
                    <FileText className="w-4 h-4 text-blue-200" />
                    <span>In phiếu báo điểm học sinh</span>
                  </button>

                  {/* Nút 2: Xuất danh sách điểm thi (Chuẩn trang in) */}
                  <button
                    onClick={() => handleOpenExportPrint()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-98"
                    title="Xuất danh sách điểm thi chuẩn trang in gồm Sheet 1 tổng hợp và các sheet riêng từng lớp"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất danh sách điểm thi</span>
                  </button>

                  {/* Nút 3: Sửa / Cập nhật dữ liệu đợt này */}
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-colors active:scale-98"
                    title="Chỉnh sửa thông tin tên, thay file Excel hoặc cập nhật lại tiêu chí & mốc thống kê điểm"
                  >
                    <Edit3 className="w-4 h-4 text-amber-600" />
                    <span>Sửa / Cập nhật dữ liệu</span>
                  </button>

                  {/* Nút 4: Tạo lần thống kê mới */}
                  <button
                    onClick={() => setIsNewModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Tạo lần thống kê mới</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'overview'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  <span>1. Tổng Quan & Bảng Xếp Hạng ({currentSession.students.length} HS)</span>
                </button>

                <button
                  onClick={() => setActiveTab('criteria')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'criteria'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>2. Thống Kê Tiêu Chuẩn & Phổ Điểm</span>
                </button>

                <button
                  onClick={() => setActiveTab('classes')}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'classes'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>3. Báo Cáo Phân Tách Từng Lớp ({currentSession.classes.length} Lớp - Căn Trang In)</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'overview' && (
              <OverviewTab
                session={currentSession}
                onExportMultiSheet={() => handleOpenExportPrint()}
                onOpenGradeSlipModal={(cName, stId) => handleOpenGradeSlip(cName, stId)}
              />
            )}

            {activeTab === 'criteria' && (
              <CriteriaStatsTab session={currentSession} />
            )}

            {activeTab === 'classes' && (
              <ClassReportTab
                session={currentSession}
                onUpdateSession={(updated) => {
                  setCurrentSession(updated);
                  reloadSessions();
                }}
                onExportMultiSheet={() => handleOpenExportPrint()}
                onOpenExportPrintModal={(cName) => handleOpenExportPrint(cName)}
                onOpenGradeSlipModal={(cName, stId) => handleOpenGradeSlip(cName, stId)}
              />
            )}
          </>
        ) : (
          <div className="py-20 text-center space-y-4">
            <School className="w-16 h-16 text-indigo-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800">
              Chưa Có Đợt Thống Kê Nào Đang Mở
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              Bạn đã xóa hết các đợt thống kê trong bộ nhớ. Hãy bấm <strong>Tạo lần thống kê mới</strong> để tải tệp điểm học sinh hoặc nạp lại dữ liệu mẫu Trường THCS Thư Vũ.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all active:scale-98"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo lần thống kê mới</span>
              </button>
              <button
                onClick={handleLoadSampleDirectly}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Nạp dữ liệu mẫu Trường THCS Thư Vũ (169 HS - 5 lớp)</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 border border-slate-700">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      <NewStatModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSessionCreated={handleSessionCreated}
      />

      <TemplateModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onLoadSampleDataDirectly={handleLoadSampleDirectly}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        savedSessions={savedSessions}
        currentSessionId={currentSession?.id || null}
        onSelectSession={(s) => {
          setCurrentSession(s);
          showToast(`Đã mở đợt "${s.name}"`);
        }}
        onReloadSessions={reloadSessions}
        onOpenNewModal={() => setIsNewModalOpen(true)}
      />

      {currentSession && (
        <ExportPrintModal
          isOpen={isExportPrintModalOpen}
          onClose={() => setIsExportPrintModalOpen(false)}
          session={currentSession}
          initialClass={exportModalInitialClass}
        />
      )}

      {currentSession && (
        <GradeSlipModal
          isOpen={isGradeSlipModalOpen}
          onClose={() => setIsGradeSlipModalOpen(false)}
          session={currentSession}
          initialClass={gradeSlipInitialClass}
          initialStudentId={gradeSlipInitialStudentId}
        />
      )}

      {currentSession && (
        <EditStatModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          session={currentSession}
          onSessionUpdated={(updated) => {
            setCurrentSession(updated);
            reloadSessions();
            showToast(`Đã cập nhật thành công đợt "${updated.name}"`);
          }}
        />
      )}
    </div>
  );
}
