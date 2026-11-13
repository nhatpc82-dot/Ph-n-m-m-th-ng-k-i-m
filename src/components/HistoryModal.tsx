import React, { useState } from 'react';
import {
  X,
  FolderClock,
  Trash2,
  FileSpreadsheet,
  Download,
  Calendar,
  School,
  Users,
  HardDrive,
  Edit2,
  Edit3,
  Check,
  AlertTriangle,
  Upload,
  PlusCircle
} from 'lucide-react';
import { StatisticSession } from '../types';
import { deleteSession, clearAllSessions, updateSession, saveSession } from '../services/storage';
import { exportMultiSheetWorkbook } from '../services/excelService';
import { EditStatModal } from './EditStatModal';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSessions: StatisticSession[];
  currentSessionId: string | null;
  onSelectSession: (session: StatisticSession) => void;
  onReloadSessions: () => void;
  onOpenNewModal?: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  savedSessions,
  currentSessionId,
  onSelectSession,
  onReloadSessions,
  onOpenNewModal,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingSession, setEditingSession] = useState<StatisticSession | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (!isOpen) return null;

  const handleSessionUpdated = async (updated: StatisticSession) => {
    setEditingSession(null);
    await onReloadSessions();
    if (updated.id === currentSessionId) {
      onSelectSession(updated);
    }
  };

  const handleStartRename = (session: StatisticSession) => {
    setEditingId(session.id);
    setEditingName(session.name);
  };

  const handleSaveRename = async (session: StatisticSession) => {
    if (!editingName.trim()) return;
    const updated = { ...session, name: editingName.trim() };
    await updateSession(updated);
    setEditingId(null);
    onReloadSessions();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      setConfirmDeleteId(null);
      await onReloadSessions();
    } catch (err) {
      console.error('Lỗi khi xóa đợt thống kê:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllSessions();
      setConfirmClearAll(false);
      await onReloadSessions();
    } catch (err) {
      console.error('Lỗi khi xóa tất cả đợt thống kê:', err);
    }
  };

  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedSessions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `EduStat_Backup_All_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (Array.isArray(json)) {
          for (const s of json) {
            await saveSession(s);
          }
          onReloadSessions();
          alert(`Đã khôi phục thành công ${json.length} đợt thống kê từ file sao lưu!`);
        }
      } catch (err) {
        alert('File sao lưu JSON không đúng định dạng!');
      }
    };
    reader.readAsText(e.target.files[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FolderClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Quản Lý Dữ Liệu Thống Kê
              </h3>
              <p className="text-xs text-slate-500">
                Dữ liệu được lưu trữ lâu dài an toàn trên thiết bị của bạn. Bạn có thể mở lại hoặc xóa khi không cần thiết.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenNewModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNewModal();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0"
                title="Tạo lần thống kê mới từ tệp Excel"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo lần thống kê mới</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
          {savedSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <HardDrive className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-sm font-semibold text-slate-600">Chưa có đợt thống kê nào trong kho lưu trữ</p>
              <p className="text-xs text-slate-500">Toàn bộ dữ liệu đã được xóa hoặc chưa được tạo. Bạn có thể bấm "Tạo lần thống kê mới" bất kỳ lúc nào.</p>
              {onOpenNewModal && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenNewModal();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-98"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Tạo lần thống kê mới ngay</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            savedSessions.map((session) => {
              const isCurrent = session.id === currentSessionId;
              const dateStr = new Date(session.createdAt).toLocaleDateString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });

              return (
                <div
                  key={session.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isCurrent
                      ? 'border-indigo-400 bg-indigo-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      {/* Name & Rename */}
                      {editingId === session.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="px-2 py-1 text-xs font-bold border border-indigo-500 rounded focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(session)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {session.name}
                          </h4>
                          {isCurrent && (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                              Đang mở
                            </span>
                          )}
                          <button
                            onClick={() => handleStartRename(session)}
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                            title="Đổi tên đợt thống kê"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {dateStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <School className="w-3.5 h-3.5 text-slate-400" />
                          {session.schoolName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {session.students.length} học sinh ({session.classes.length} lớp)
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          Tệp: {session.fileName} ({(session.fileSize / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Select / Open */}
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            onSelectSession(session);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                        >
                          Mở xem
                        </button>
                      )}

                      {/* Edit Session */}
                      <button
                        onClick={() => setEditingSession(session)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                        title="Chỉnh sửa thông tin, thay tệp Excel hoặc cập nhật tiêu chí / mốc thống kê điểm"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Sửa dữ liệu</span>
                      </button>

                      {/* Export Excel */}
                      <button
                        onClick={() => exportMultiSheetWorkbook(session)}
                        className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        title="Tải file Excel tách sheet của đợt này"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      {confirmDeleteId === session.id ? (
                        <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200">
                          <span className="text-[10px] text-red-700 font-bold px-1">Xóa?</span>
                          <button
                            onClick={() => handleDelete(session.id)}
                            className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded"
                          >
                            Có
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 text-slate-500 text-[10px] rounded hover:bg-slate-200"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(session.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa đợt thống kê và file này khỏi bộ nhớ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer & Backup/Restore */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              disabled={savedSessions.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sao lưu dữ liệu (JSON)</span>
            </button>

            <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Khôi phục sao lưu</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            {savedSessions.length > 0 && (
              <>
                {confirmClearAll ? (
                  <div className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
                    <span className="text-[11px] text-red-700 font-bold">Xóa tất cả?</span>
                    <button
                      onClick={handleClearAll}
                      className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold"
                    >
                      Xác nhận
                    </button>
                    <button
                      onClick={() => setConfirmClearAll(false)}
                      className="text-slate-500 text-[10px]"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClearAll(true)}
                    className="text-red-600 hover:underline text-xs font-semibold mr-2"
                  >
                    Xóa tất cả dữ liệu
                  </button>
                )}
              </>
            )}

            {onOpenNewModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNewModal();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Tạo lần thống kê mới</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold text-xs transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Edit Statistical Session Modal */}
      {editingSession && (
        <EditStatModal
          isOpen={!!editingSession}
          onClose={() => setEditingSession(null)}
          session={editingSession}
          onSessionUpdated={handleSessionUpdated}
        />
      )}
    </div>
  );
};
