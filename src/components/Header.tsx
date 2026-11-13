import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  PlusCircle, 
  FolderClock, 
  Download, 
  BookOpenCheck,
  School,
  Sparkles,
  FileText,
  Camera
} from 'lucide-react';
import { StatisticSession } from '../types';

interface HeaderProps {
  currentSession: StatisticSession | null;
  savedSessions: StatisticSession[];
  onSelectSession: (session: StatisticSession) => void;
  onOpenNewModal: () => void;
  onOpenTemplatesModal: () => void;
  onOpenHistoryModal: () => void;
  onExportMultiSheet: () => void;
  onExportSummary: () => void;
  onOpenGradeSlipModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSession,
  savedSessions,
  onSelectSession,
  onOpenNewModal,
  onOpenTemplatesModal,
  onOpenHistoryModal,
  onExportMultiSheet,
  onExportSummary,
  onOpenGradeSlipModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoSrc, setLogoSrc] = useState<string>(() => {
    return localStorage.getItem('custom_app_logo') || '/assets/app_logo_nhat.jpg';
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          setLogoSrc(result);
          try {
            localStorage.setItem('custom_app_logo', result);
          } catch (err) {
            console.warn('Could not save custom logo to localStorage', err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2.5 min-h-[4.5rem]">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div 
              className="relative group cursor-pointer shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Nhấp để tải lên / thay đổi ảnh logo phần mềm"
            >
              <img
                src={logoSrc}
                alt="Logo Vũ Văn Nhật - THCS Thư Vũ"
                className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500/80 shadow-md shadow-emerald-200/60 group-hover:scale-105 group-hover:border-emerald-600 transition-all duration-200"
                onError={(e) => {
                  // Fallback to default asset if error
                  (e.target as HTMLImageElement).src = '/logo.png';
                }}
              />
              <div className="absolute inset-0 bg-slate-900/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <Camera className="w-4 h-4" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent">
                  EduStat<span className="text-indigo-600">.Pro</span>
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  THCS Thư Vũ
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Hệ thống Thống kê Điểm & Tự động Phân tách Báo cáo theo Lớp
              </p>
              <p className="text-[11px] text-indigo-700 font-bold tracking-tight mt-0.5">
                Vũ Văn Nhật - THCS Thư Vũ - SĐT: 0972486482
              </p>
            </div>
          </div>

          {/* Active Session & Switcher */}
          {currentSession && savedSessions.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 max-w-xs">
              <School className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Đợt thống kê hiện tại:
                </p>
                <select
                  value={currentSession.id}
                  onChange={(e) => {
                    const found = savedSessions.find((s) => s.id === e.target.value);
                    if (found) onSelectSession(found);
                  }}
                  className="text-xs font-semibold text-slate-800 bg-transparent border-0 p-0 focus:ring-0 truncate cursor-pointer w-full"
                >
                  {savedSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tải tệp mẫu */}
            <button
              onClick={onOpenTemplatesModal}
              title="Tải tệp mẫu Excel chuẩn để nhập liệu hoặc thống kê"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Tệp mẫu Excel</span>
            </button>

            {/* Nút Tạo lần thống kê mới (Đưa lên trước Quản lý dữ liệu) */}
            <button
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-lg shadow-sm shadow-indigo-300 hover:shadow-md transition-all active:scale-[0.98]"
              title="Tạo đợt thống kê mới từ tệp Excel"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo lần thống kê mới</span>
            </button>

            {/* Quản lý dữ liệu thống kê & Lịch sử */}
            <button
              onClick={onOpenHistoryModal}
              title="Quản lý và xem lại các file, bảng thống kê đã lưu lâu dài"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors relative"
            >
              <FolderClock className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Quản lý dữ liệu thống kê</span>
              <span className="sm:hidden">Dữ liệu</span>
              {savedSessions.length > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                  {savedSessions.length}
                </span>
              )}
            </button>

            {/* Nút Xuất danh sách điểm thi (chuẩn trang in) */}
            {currentSession && (
              <div className="relative group">
                <button
                  onClick={onExportMultiSheet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all shadow-xs"
                  title="Xuất danh sách điểm thi chuẩn trang in gồm Sheet 1 tổng hợp và mỗi lớp một sheet"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Xuất danh sách điểm thi</span>
                  <span className="sm:hidden">Xuất điểm</span>
                </button>
              </div>
            )}

            {/* Nút In phiếu báo điểm học sinh (Chuẩn Bộ GD&ĐT & Xuất Word .docx) */}
            {currentSession && onOpenGradeSlipModal && (
              <button
                onClick={onOpenGradeSlipModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all shadow-xs"
                title="In trực tiếp phiếu báo điểm từng học sinh hoặc xuất file Word (.docx) chuẩn theo lớp"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">In phiếu báo điểm</span>
                <span className="sm:hidden">Phiếu điểm</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
