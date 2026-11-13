import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  CheckSquare,
  Square,
  RotateCcw,
  Sliders,
  Eye,
  Settings2,
  Layers,
  School,
  Sparkles,
  Info,
  Maximize2,
  ChevronDown,
  LayoutGrid,
  UploadCloud,
  Trash2
} from 'lucide-react';
import {
  StatisticSession,
  Student,
  ExportPrintConfig,
  ReportCustomInfo,
  createDefaultExportConfig,
} from '../types';
import { exportCustomExcel } from '../services/excelService';
import { printHTML, generateReportPrintHTML } from '../services/printService';

interface ExportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StatisticSession;
  initialClass?: string;
}

export const ExportPrintModal: React.FC<ExportPrintModalProps> = ({
  isOpen,
  onClose,
  session,
  initialClass,
}) => {
  const [config, setConfig] = useState<ExportPrintConfig>(() =>
    createDefaultExportConfig(session, initialClass)
  );

  // Active preview tab for mobile / small screens or previewing specific class
  const [previewClass, setPreviewClass] = useState<string>(
    initialClass || session.classes[0] || ''
  );
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('preview');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isCustomInfoOpen, setIsCustomInfoOpen] = useState<boolean>(true);
  const lastSessionIdRef = useRef<string>(session.id);

  const gvbmSigInputRef = useRef<HTMLInputElement>(null);
  const gvcnSigInputRef = useRef<HTMLInputElement>(null);
  const bghSigInputRef = useRef<HTMLInputElement>(null);

  // If initialClass changes or modal reopens
  React.useEffect(() => {
    if (isOpen) {
      const isSameSession = lastSessionIdRef.current === session.id;
      lastSessionIdRef.current = session.id;
      setConfig((prev) => {
        const fresh = createDefaultExportConfig(session, initialClass);
        return {
          ...fresh,
          classScope: initialClass ? 'current' : prev.classScope,
          selectedClasses: initialClass ? [initialClass] : prev.selectedClasses,
          customInfo: isSameSession && prev.customInfo ? prev.customInfo : fresh.customInfo,
        };
      });
      if (initialClass) {
        setPreviewClass(initialClass);
      }
    }
  }, [isOpen, initialClass, session]);

  const hasRooms = useMemo(() => {
    return session.students.some((s) => s.examRoom);
  }, [session]);

  const targetClasses = useMemo(() => {
    if (config.classScope === 'current') {
      return config.selectedClasses.slice(0, 1);
    }
    if (config.classScope === 'custom') {
      return config.selectedClasses;
    }
    return session.classes;
  }, [config.classScope, config.selectedClasses, session.classes]);

  // Keep previewClass valid: if multiple classes, allow 'ALL' (Sheet 1)
  React.useEffect(() => {
    if (targetClasses.length > 1) {
      if (previewClass !== 'ALL' && !targetClasses.includes(previewClass)) {
        setPreviewClass('ALL');
      }
    } else if (targetClasses.length === 1) {
      if (previewClass !== targetClasses[0]) {
        setPreviewClass(targetClasses[0]);
      }
    }
  }, [targetClasses, previewClass]);

  const isPreviewOverall = previewClass === 'ALL' && targetClasses.length > 1;

  const currentClassSummary = useMemo(() => {
    if (isPreviewOverall) return null;
    return session.classSummaries[previewClass] || null;
  }, [session, previewClass, isPreviewOverall]);

  const currentClassStudents = useMemo(() => {
    if (isPreviewOverall) {
      return session.students
        .filter((s) => targetClasses.includes(s.className))
        .sort((a, b) => a.schoolRank - b.schoolRank);
    }
    return session.students
      .filter((s) => s.className === previewClass)
      .sort((a, b) => a.classRank - b.classRank);
  }, [session, previewClass, isPreviewOverall, targetClasses]);

  // Active student table columns
  const activeStudentColumns = useMemo(() => {
    const cols: Array<{ key: string; label: string; align: 'left' | 'center' | 'right' }> = [];
    if (config.columns.stt) cols.push({ key: 'stt', label: 'STT', align: 'center' });
    if (config.columns.sbd) cols.push({ key: 'sbd', label: 'Số báo danh', align: 'center' });
    if (config.columns.name) cols.push({ key: 'name', label: 'Họ và tên', align: 'left' });
    if (config.columns.dob) cols.push({ key: 'dob', label: 'Ngày sinh', align: 'center' });
    if (config.columns.examRoom && hasRooms) cols.push({ key: 'examRoom', label: 'Phòng thi', align: 'center' });
    if (config.columns.gender) cols.push({ key: 'gender', label: 'Giới tính', align: 'center' });
    if (config.columns.className || isPreviewOverall) cols.push({ key: 'className', label: 'Lớp', align: 'center' });
    if (config.columns.grade) cols.push({ key: 'grade', label: 'Khối', align: 'center' });

    session.subjects.forEach((sub) => {
      if (config.columns.subjects[sub] !== false) {
        cols.push({ key: `sub_${sub}`, label: sub, align: 'center' });
      }
    });

    if (config.columns.totalScore) cols.push({ key: 'totalScore', label: 'Tổng điểm', align: 'right' });
    if (config.columns.averageScore) cols.push({ key: 'averageScore', label: 'Điểm TB', align: 'right' });
    if (config.columns.classRank) cols.push({ key: 'classRank', label: 'Thứ Lớp', align: 'center' });
    if (config.columns.schoolRank) cols.push({ key: 'schoolRank', label: 'Thứ Trường', align: 'center' });
    if (config.columns.notes) cols.push({ key: 'notes', label: 'Ghi chú', align: 'left' });

    return cols;
  }, [config.columns, session.subjects, hasRooms]);

  // Active criteria columns in Table I
  const activeCriteriaList = useMemo(() => {
    const list: Array<{ id: string; label: string }> = [];
    if (config.summaryCriteria.count) list.push({ id: 'count', label: 'Số bài' });
    if (config.summaryCriteria.avgScore) list.push({ id: 'avgScore', label: 'Điểm TB' });
    if (config.summaryCriteria.maxScore) list.push({ id: 'maxScore', label: 'Max' });
    if (config.summaryCriteria.minScore) list.push({ id: 'minScore', label: 'Min' });

    session.intervals.forEach((inv) => {
      if (config.summaryCriteria.intervals[inv.id] !== false) {
        list.push({ id: `inv_${inv.id}`, label: inv.label });
      }
    });

    if (config.summaryCriteria.above5) {
      list.push({ id: 'above5Count', label: 'Đạt (≥5)' });
      list.push({ id: 'above5Percent', label: '% Đạt' });
    }
    if (config.summaryCriteria.above8) {
      list.push({ id: 'above8Count', label: 'Giỏi (≥8)' });
      list.push({ id: 'above8Percent', label: '% Giỏi' });
    }

    return list;
  }, [config.summaryCriteria, session.intervals]);

  if (!isOpen) return null;

  // Toggle helpers
  const handleToggleColumn = (colKey: keyof ExportPrintConfig['columns']) => {
    setConfig((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        [colKey]: !prev.columns[colKey],
      },
    }));
  };

  const handleToggleSubject = (sub: string) => {
    setConfig((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        subjects: {
          ...prev.columns.subjects,
          [sub]: !prev.columns.subjects[sub],
        },
      },
    }));
  };

  const handleToggleAllSubjects = (selectAll: boolean) => {
    const newSubs: Record<string, boolean> = {};
    session.subjects.forEach((sub) => {
      newSubs[sub] = selectAll;
    });
    setConfig((prev) => ({
      ...prev,
      columns: {
        ...prev.columns,
        subjects: newSubs,
      },
    }));
  };

  const handleToggleInterval = (invId: string) => {
    setConfig((prev) => ({
      ...prev,
      summaryCriteria: {
        ...prev.summaryCriteria,
        intervals: {
          ...prev.summaryCriteria.intervals,
          [invId]: !prev.summaryCriteria.intervals[invId],
        },
      },
    }));
  };

  const handleToggleAllIntervals = (selectAll: boolean) => {
    const newInvs: Record<string, boolean> = {};
    session.intervals.forEach((inv) => {
      newInvs[inv.id] = selectAll;
    });
    setConfig((prev) => ({
      ...prev,
      summaryCriteria: {
        ...prev.summaryCriteria,
        intervals: newInvs,
      },
    }));
  };

  const handleToggleClass = (cName: string) => {
    setConfig((prev) => {
      const exists = prev.selectedClasses.includes(cName);
      let updated = exists
        ? prev.selectedClasses.filter((c) => c !== cName)
        : [...prev.selectedClasses, cName];
      if (updated.length === 0) updated = [cName]; // Keep at least one
      return {
        ...prev,
        selectedClasses: updated,
      };
    });
  };

  const updateCustomInfo = (patch: Partial<ReportCustomInfo>) => {
    setConfig((prev) => {
      const base = prev.customInfo || createDefaultExportConfig(session, initialClass).customInfo!;
      return {
        ...prev,
        customInfo: {
          ...base,
          ...patch,
        },
      };
    });
  };

  const handleSigImageUpload = (
    field: 'subjectTeacherSignatureImage' | 'homeroomTeacherSignatureImage' | 'headmasterSignatureImage',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === 'string') {
          updateCustomInfo({ [field]: evt.target.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const customInfo = config.customInfo || createDefaultExportConfig(session, initialClass).customInfo!;

  // Execution: Export Excel
  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      await exportCustomExcel(session, config);
      onClose();
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Execution: Print with system default printer & browser dialog
  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const fullHTML = generateReportPrintHTML(session, targetClasses, config);
      printHTML(fullHTML, {
        orientation: config.orientation,
        paperSize: config.paperSize,
        title: `Bao_Cao_Diem_${session.name}`,
        onAfterPrint: () => setIsPrinting(false),
      });
    } catch (err) {
      console.error('Lỗi in báo cáo:', err);
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-7xl w-full shadow-2xl border border-slate-200 flex flex-col h-[94vh] max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Cấu Hình & Xem Trước Bản In / Xuất Danh Sách Điểm Thi
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {config.orientation === 'landscape' ? 'Khổ Ngang (A4)' : 'Khổ Dọc (A4)'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Lựa chọn cột cần xuất, tiêu chuẩn thống kê, hướng giấy in và xem trước bản in thực tế trước khi tải về
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher */}
            <div className="lg:hidden flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'config' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Cấu hình
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === 'preview' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Xem trước
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Main Content Split View (Desktop: Left Config / Right Live Preview) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0 bg-slate-50/50">
          
          {/* LEFT PANE: CONFIGURATION CONTROLS */}
          <div
            className={`lg:col-span-5 border-r border-slate-200 bg-white p-5 overflow-y-auto space-y-5 text-xs ${
              activeTab === 'config' ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* A. LỰA CHỌN LỚP CẦN XUẤT */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>1. Lựa chọn lớp cần xuất</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  {targetClasses.length} / {session.classes.length} lớp được chọn
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, classScope: 'current', selectedClasses: [previewClass] }))}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition-all ${
                    config.classScope === 'current'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1 Lớp cụ thể
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, classScope: 'all', selectedClasses: [...session.classes] }))}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition-all ${
                    config.classScope === 'all'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả các lớp
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, classScope: 'custom' }))}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition-all ${
                    config.classScope === 'custom'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tùy chọn lớp
                </button>
              </div>

              {/* Class Scope Detail Picker */}
              {config.classScope === 'current' ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-500 font-semibold shrink-0">Chọn lớp:</span>
                  <select
                    value={previewClass}
                    onChange={(e) => {
                      setPreviewClass(e.target.value);
                      setConfig((p) => ({ ...p, selectedClasses: [e.target.value] }));
                    }}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    {session.classes.map((c) => (
                      <option key={c} value={c}>
                        Lớp {c} ({session.students.filter((s) => s.className === c).length} học sinh)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {session.classes.map((c) => {
                      const isChecked = config.selectedClasses.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => handleToggleClass(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isChecked
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {isChecked ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>Lớp {c}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cấu trúc tệp xuất ra */}
                  <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5 text-[11px] text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Cấu trúc tệp Excel xuất ra ({targetClasses.length + 1} sheet):</span>
                    </div>
                    <div className="pl-4 space-y-0.5 text-slate-700">
                      <div>• <strong>Sheet 1: Tất cả các lớp</strong> (tổng hợp toàn bộ học sinh).</div>
                      <div>• <strong>Các sheet tiếp theo:</strong> Tách riêng mỗi lớp 1 sheet và đặt tên sheet theo đúng tên lớp.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* B. HƯỚNG GIẤY IN & KHỔ GIẤY */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200">
              <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>2. Hướng giấy in & Khổ giấy</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, orientation: 'landscape' }))}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    config.orientation === 'landscape'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <div className="text-xs">Khổ Ngang (Landscape)</div>
                  <div className="text-[10px] text-slate-500 font-normal">Khuyên dùng cho nhiều môn</div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, orientation: 'portrait' }))}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    config.orientation === 'portrait'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <div className="text-xs">Khổ Dọc (Portrait)</div>
                  <div className="text-[10px] text-slate-500 font-normal">Phù hợp khi ít cột điểm</div>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {(['a4', 'a3', 'letter'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, paperSize: sz }))}
                    className={`py-1.5 text-center rounded-lg text-xs font-bold uppercase transition-all ${
                      config.paperSize === sz
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* C. LỰA CHỌN CÁC CỘT CẦN XUẤT */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <LayoutGrid className="w-4 h-4 text-indigo-600" />
                  <span>3. Lựa chọn các cột học sinh cần xuất</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const allSubs: Record<string, boolean> = {};
                      session.subjects.forEach((s) => (allSubs[s] = true));
                      setConfig((p) => ({
                        ...p,
                        columns: {
                          stt: true,
                          sbd: true,
                          name: true,
                          dob: true,
                          examRoom: hasRooms,
                          gender: true,
                          className: true,
                          grade: true,
                          subjects: allSubs,
                          totalScore: true,
                          averageScore: true,
                          classRank: true,
                          schoolRank: true,
                          notes: true,
                        },
                      }));
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Tất cả
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allSubs: Record<string, boolean> = {};
                      session.subjects.forEach((s) => (allSubs[s] = true));
                      setConfig((p) => ({
                        ...p,
                        columns: {
                          stt: true,
                          sbd: true,
                          name: true,
                          dob: true,
                          examRoom: hasRooms,
                          gender: true,
                          className: false,
                          grade: false,
                          subjects: allSubs,
                          totalScore: true,
                          averageScore: true,
                          classRank: true,
                          schoolRank: true,
                          notes: false,
                        },
                      }));
                    }}
                    className="text-[10px] font-bold text-slate-600 hover:underline"
                  >
                    Chuẩn
                  </button>
                </div>
              </div>

              {/* Nhóm 1: Thông tin học sinh */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Thông tin cơ bản học sinh:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.columns.stt}
                      onChange={() => handleToggleColumn('stt')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>STT</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.columns.sbd}
                      onChange={() => handleToggleColumn('sbd')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Số báo danh</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.columns.name}
                      onChange={() => handleToggleColumn('name')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Họ và tên</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.columns.dob}
                      onChange={() => handleToggleColumn('dob')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Ngày sinh</span>
                  </label>
                  {hasRooms && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={config.columns.examRoom}
                        onChange={() => handleToggleColumn('examRoom')}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span className="font-bold text-indigo-900">Phòng thi</span>
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.columns.gender}
                      onChange={() => handleToggleColumn('gender')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Giới tính</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.columns.className}
                      onChange={() => handleToggleColumn('className')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Tên lớp</span>
                  </label>
                </div>
              </div>

              {/* Nhóm 2: Môn thi */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                    Cột điểm các môn thi ({session.subjects.length} môn):
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleAllSubjects(true)}
                      className="text-[10px] text-indigo-600 hover:underline font-semibold"
                    >
                      Bật hết
                    </button>
                    <span className="text-slate-300">/</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAllSubjects(false)}
                      className="text-[10px] text-slate-500 hover:underline font-semibold"
                    >
                      Tắt hết
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {session.subjects.map((sub) => {
                    const isChecked = config.columns.subjects[sub] !== false;
                    return (
                      <label key={sub} className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSubject(sub)}
                          className="w-4 h-4 rounded text-indigo-600"
                        />
                        <span>{sub}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Nhóm 3: Kết quả & Xếp thứ */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Điểm tổng & Xếp hạng:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-indigo-950 font-bold">
                    <input
                      type="checkbox"
                      checked={config.columns.totalScore}
                      onChange={() => handleToggleColumn('totalScore')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Tổng điểm</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-semibold">
                    <input
                      type="checkbox"
                      checked={config.columns.averageScore}
                      onChange={() => handleToggleColumn('averageScore')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Điểm TB</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-emerald-900 font-bold">
                    <input
                      type="checkbox"
                      checked={config.columns.classRank}
                      onChange={() => handleToggleColumn('classRank')}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    <span>Thứ Lớp</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-amber-900 font-bold">
                    <input
                      type="checkbox"
                      checked={config.columns.schoolRank}
                      onChange={() => handleToggleColumn('schoolRank')}
                      className="w-4 h-4 rounded text-amber-600"
                    />
                    <span>Thứ Trường</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={config.columns.notes}
                      onChange={() => handleToggleColumn('notes')}
                      className="w-4 h-4 rounded text-indigo-600"
                    />
                    <span>Ghi chú</span>
                  </label>
                </div>
              </div>
            </div>

            {/* D. CHỌN CÁC TIÊU CHUẨN THỐNG KÊ CẦN IN (BẢNG I) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>4. Chọn tiêu chuẩn thống kê cần in (Bảng I)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-indigo-700">
                  <input
                    type="checkbox"
                    checked={config.showSummaryTable}
                    onChange={(e) => setConfig((p) => ({ ...p, showSummaryTable: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span>Bật Bảng I</span>
                </label>
              </div>

              {config.showSummaryTable && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2.5">
                  {/* Chỉ số cơ bản */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={config.summaryCriteria.count}
                        onChange={() =>
                          setConfig((p) => ({
                            ...p,
                            summaryCriteria: { ...p.summaryCriteria, count: !p.summaryCriteria.count },
                          }))
                        }
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span>Số bài thi</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={config.summaryCriteria.avgScore}
                        onChange={() =>
                          setConfig((p) => ({
                            ...p,
                            summaryCriteria: { ...p.summaryCriteria, avgScore: !p.summaryCriteria.avgScore },
                          }))
                        }
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span>Điểm TB</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={config.summaryCriteria.maxScore}
                        onChange={() =>
                          setConfig((p) => ({
                            ...p,
                            summaryCriteria: { ...p.summaryCriteria, maxScore: !p.summaryCriteria.maxScore },
                          }))
                        }
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span>Điểm Max</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={config.summaryCriteria.minScore}
                        onChange={() =>
                          setConfig((p) => ({
                            ...p,
                            summaryCriteria: { ...p.summaryCriteria, minScore: !p.summaryCriteria.minScore },
                          }))
                        }
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span>Điểm Min</span>
                    </label>
                  </div>

                  {/* Khoảng điểm tiêu chuẩn */}
                  <div className="pt-1.5 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Các mốc khoảng điểm:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAllIntervals(true)}
                          className="text-[10px] text-indigo-600 hover:underline font-semibold"
                        >
                          Chọn hết
                        </button>
                        <span className="text-slate-300">/</span>
                        <button
                          type="button"
                          onClick={() => handleToggleAllIntervals(false)}
                          className="text-[10px] text-slate-500 hover:underline font-semibold"
                        >
                          Bỏ hết
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {session.intervals.map((inv) => {
                        const isChecked = config.summaryCriteria.intervals[inv.id] !== false;
                        return (
                          <label key={inv.id} className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleInterval(inv.id)}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="text-[11px]">{inv.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Đạt & Giỏi */}
                  <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-emerald-800 font-bold">
                      <input
                        type="checkbox"
                        checked={config.summaryCriteria.above5}
                        onChange={() =>
                          setConfig((p) => ({
                            ...p,
                            summaryCriteria: { ...p.summaryCriteria, above5: !p.summaryCriteria.above5 },
                          }))
                        }
                        className="w-4 h-4 rounded text-emerald-600"
                      />
                      <span>Đạt (≥5.0) & % Đạt</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-blue-800 font-bold">
                      <input
                        type="checkbox"
                        checked={config.summaryCriteria.above8}
                        onChange={() =>
                          setConfig((p) => ({
                            ...p,
                            summaryCriteria: { ...p.summaryCriteria, above8: !p.summaryCriteria.above8 },
                          }))
                        }
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>Giỏi (≥8.0) & % Giỏi</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* E. KHUNG CHỮ KÝ & LẶP LẠI TIÊU ĐỀ */}
            <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-bold">
                <input
                  type="checkbox"
                  checked={config.showSignatures}
                  onChange={(e) => setConfig((p) => ({ ...p, showSignatures: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span>Bao gồm Khung chữ ký 3 bên (GV Bộ môn, GV Chủ nhiệm, Ban Giám hiệu)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={config.repeatHeaderOnEveryPage}
                  onChange={(e) => setConfig((p) => ({ ...p, repeatHeaderOnEveryPage: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span>Tự động lặp lại dòng tiêu đề cột trên mọi trang in khi danh sách dài (Print Titles)</span>
              </label>
            </div>

            {/* F. TÙY CHỈNH THÔNG TIN ĐƠN VỊ & CHÈN ẢNH CHỮ KÝ / CON DẤU */}
            <div className="bg-white rounded-xl border border-indigo-200 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsCustomInfoOpen(!isCustomInfoOpen)}
                className="w-full p-3.5 text-left flex items-center justify-between bg-indigo-50/70 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    5. Tùy chỉnh thông tin tiêu đề & chữ ký (có chèn ảnh)
                  </span>
                </div>
                <span className="text-[11px] text-indigo-700 font-bold shrink-0">
                  {isCustomInfoOpen ? 'Thu gọn ▲' : 'Chỉnh sửa ▼'}
                </span>
              </button>

              {isCustomInfoOpen && (
                <div className="p-3.5 space-y-3 border-t border-indigo-100 bg-white">
                  {/* Khối tiêu đề đơn vị & Ngày tháng ký */}
                  <div className="space-y-2.5 p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Thông tin đơn vị & Ngày ký
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const def = createDefaultExportConfig(session, initialClass).customInfo!;
                          updateCustomInfo(def);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-indigo-600"
                        title="Khôi phục thông tin mặc định"
                      >
                        <RotateCcw className="w-3 h-3" /> Mặc định
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Cơ quan cấp trên (Sở / Phòng GD / UBND):
                      </label>
                      <input
                        type="text"
                        value={customInfo.departmentName}
                        onChange={(e) => updateCustomInfo({ departmentName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                        placeholder="SỞ GIÁO DỤC VÀ ĐÀO TẠO"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Tên trường học:
                      </label>
                      <input
                        type="text"
                        value={customInfo.schoolName}
                        onChange={(e) => updateCustomInfo({ schoolName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-bold"
                        placeholder="Trường THCS Thư Vũ"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Dòng phụ dưới tên trường:
                      </label>
                      <input
                        type="text"
                        value={customInfo.documentSubTitle}
                        onChange={(e) => updateCustomInfo({ documentSubTitle: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white italic"
                        placeholder="Đơn vị lưu trữ hồ sơ khảo sát"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        Dòng ngày tháng ký (Góc dưới phải):
                      </label>
                      <input
                        type="text"
                        value={customInfo.signDate}
                        onChange={(e) => updateCustomInfo({ signDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white italic"
                        placeholder="Ngày ..... tháng ..... năm 20...."
                      />
                    </div>
                  </div>

                  {/* 1. Giáo viên bộ môn */}
                  <div className="space-y-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">
                          Tiêu đề cột 1:
                        </label>
                        <input
                          type="text"
                          value={customInfo.subjectTeacherTitle}
                          onChange={(e) => updateCustomInfo({ subjectTeacherTitle: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-bold uppercase"
                          placeholder="GIÁO VIÊN BỘ MÔN"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">
                          Tên Giáo viên bộ môn:
                        </label>
                        <input
                          type="text"
                          value={customInfo.subjectTeacherName}
                          onChange={(e) => updateCustomInfo({ subjectTeacherName: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                          placeholder="(Để trống để ký tay)"
                        />
                      </div>
                    </div>

                    <div className="pt-0.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span className="font-semibold">Ảnh chữ ký Giáo viên bộ môn:</span>
                        {customInfo.subjectTeacherSignatureImage && (
                          <button
                            type="button"
                            onClick={() => {
                              updateCustomInfo({ subjectTeacherSignatureImage: undefined });
                              if (gvbmSigInputRef.current) gvbmSigInputRef.current.value = '';
                            }}
                            className="text-[10px] text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa ảnh
                          </button>
                        )}
                      </div>

                      {customInfo.subjectTeacherSignatureImage ? (
                        <div className="p-1.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                          <img
                            src={customInfo.subjectTeacherSignatureImage}
                            alt="Chữ ký GVBM"
                            className="h-9 max-w-[130px] object-contain border border-slate-100 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => gvbmSigInputRef.current?.click()}
                            className="text-[11px] text-indigo-600 hover:underline font-semibold"
                          >
                            Đổi ảnh
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => gvbmSigInputRef.current?.click()}
                          className="w-full py-1.5 px-2 border border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 rounded-lg text-slate-600 hover:text-indigo-600 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Chèn ảnh chữ ký có sẵn trong máy</span>
                        </button>
                      )}
                      <input
                        ref={gvbmSigInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSigImageUpload('subjectTeacherSignatureImage', e)}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* 2. Giáo viên chủ nhiệm */}
                  <div className="space-y-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">
                          Tiêu đề cột 2 (Theo lớp):
                        </label>
                        <input
                          type="text"
                          value={customInfo.homeroomTeacherTitle}
                          onChange={(e) => updateCustomInfo({ homeroomTeacherTitle: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-bold uppercase"
                          placeholder="GIÁO VIÊN CHỦ NHIỆM"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">
                          Tên Giáo viên chủ nhiệm:
                        </label>
                        <input
                          type="text"
                          value={customInfo.homeroomTeacherName}
                          onChange={(e) => updateCustomInfo({ homeroomTeacherName: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                          placeholder="(Để trống để tự lấy theo lớp)"
                        />
                      </div>
                    </div>

                    <div className="pt-0.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span className="font-semibold">Ảnh chữ ký GVCN / Tổ trưởng:</span>
                        {customInfo.homeroomTeacherSignatureImage && (
                          <button
                            type="button"
                            onClick={() => {
                              updateCustomInfo({ homeroomTeacherSignatureImage: undefined });
                              if (gvcnSigInputRef.current) gvcnSigInputRef.current.value = '';
                            }}
                            className="text-[10px] text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa ảnh
                          </button>
                        )}
                      </div>

                      {customInfo.homeroomTeacherSignatureImage ? (
                        <div className="p-1.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                          <img
                            src={customInfo.homeroomTeacherSignatureImage}
                            alt="Chữ ký GVCN"
                            className="h-9 max-w-[130px] object-contain border border-slate-100 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => gvcnSigInputRef.current?.click()}
                            className="text-[11px] text-indigo-600 hover:underline font-semibold"
                          >
                            Đổi ảnh
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => gvcnSigInputRef.current?.click()}
                          className="w-full py-1.5 px-2 border border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 rounded-lg text-slate-600 hover:text-indigo-600 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Chèn ảnh chữ ký có sẵn trong máy</span>
                        </button>
                      )}
                      <input
                        ref={gvcnSigInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSigImageUpload('homeroomTeacherSignatureImage', e)}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* 3. Ban giám hiệu / Đại diện nhà trường */}
                  <div className="space-y-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">
                          Tiêu đề cột 3:
                        </label>
                        <input
                          type="text"
                          value={customInfo.headmasterTitle}
                          onChange={(e) => updateCustomInfo({ headmasterTitle: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-bold uppercase"
                          placeholder="BAN GIÁM HIỆU"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">
                          Tên người Đại diện nhà trường / BGH:
                        </label>
                        <input
                          type="text"
                          value={customInfo.headmasterName}
                          onChange={(e) => updateCustomInfo({ headmasterName: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                          placeholder="VD: Hiệu trưởng Nguyễn Văn A"
                        />
                      </div>
                    </div>

                    <div className="pt-0.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span className="font-semibold">Ảnh con dấu / Chữ ký nhà trường:</span>
                        {customInfo.headmasterSignatureImage && (
                          <button
                            type="button"
                            onClick={() => {
                              updateCustomInfo({ headmasterSignatureImage: undefined });
                              if (bghSigInputRef.current) bghSigInputRef.current.value = '';
                            }}
                            className="text-[10px] text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa ảnh
                          </button>
                        )}
                      </div>

                      {customInfo.headmasterSignatureImage ? (
                        <div className="p-1.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                          <img
                            src={customInfo.headmasterSignatureImage}
                            alt="Dấu / Chữ ký nhà trường"
                            className="h-10 max-w-[130px] object-contain border border-slate-100 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => bghSigInputRef.current?.click()}
                            className="text-[11px] text-indigo-600 hover:underline font-semibold"
                          >
                            Đổi ảnh
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => bghSigInputRef.current?.click()}
                          className="w-full py-1.5 px-2 border border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 rounded-lg text-slate-600 hover:text-indigo-600 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Chèn ảnh con dấu / chữ ký trong máy</span>
                        </button>
                      )}
                      <input
                        ref={bghSigInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSigImageUpload('headmasterSignatureImage', e)}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANE: REAL-TIME LIVE SHEET PREVIEW (BẢN XEM TRƯỚC TRANG IN THỰC TẾ) */}
          <div
            className={`lg:col-span-7 flex flex-col overflow-hidden bg-slate-200/80 p-3 sm:p-5 ${
              activeTab === 'preview' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Preview Toolbar */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                  Bản xem trước trang in thực tế
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {activeStudentColumns.length} Cột hiển thị
                </span>
              </div>

              {/* Class Switcher in preview if multiple classes */}
              {targetClasses.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-semibold">Xem trước trang in:</span>
                  <select
                    value={previewClass}
                    onChange={(e) => setPreviewClass(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-bold bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">
                      ⭐ Sheet 1: Tất cả các lớp ({session.students.filter((s) => targetClasses.includes(s.className)).length} HS)
                    </option>
                    {targetClasses.map((c) => (
                      <option key={c} value={c}>
                        Sheet: Lớp {c} ({session.students.filter((s) => s.className === c).length} HS)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Scrollable Simulated A4 Page Container */}
            <div className="flex-1 overflow-auto rounded-xl p-2 sm:p-4 bg-slate-300/60 flex items-start justify-center">
              <div
                className={`bg-white shadow-2xl rounded-sm p-6 sm:p-8 text-slate-900 transition-all font-serif ${
                  config.orientation === 'landscape'
                    ? 'w-full max-w-4xl min-w-[760px]'
                    : 'w-full max-w-2xl min-w-[580px]'
                }`}
                style={{ fontSize: '11px' }}
              >
                {/* 1. Header Báo cáo Quốc hiệu & Trường */}
                <div className="flex items-start justify-between pb-3 border-b-2 border-slate-800">
                  <div className="text-center w-[42%] font-sans">
                    <p className="font-bold text-slate-800 uppercase tracking-wide text-[10px]">
                      {customInfo.departmentName || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}
                    </p>
                    <p className="font-extrabold text-slate-950 uppercase text-[11px] mt-0.5">
                      {(customInfo.schoolName || session.schoolName).trim().toUpperCase().startsWith('TRƯỜNG:')
                        ? (customInfo.schoolName || session.schoolName).trim().toUpperCase()
                        : `TRƯỜNG: ${(customInfo.schoolName || session.schoolName).trim().toUpperCase()}`}
                    </p>
                    <p className="text-[9.5px] text-slate-500 italic mt-0.5 font-serif">
                      {customInfo.documentSubTitle || 'Đơn vị lưu trữ hồ sơ khảo sát'}
                    </p>
                  </div>
                  <div className="text-center w-[50%] font-sans">
                    <p className="font-extrabold text-slate-950 uppercase tracking-wider text-[10.5px]">
                      {customInfo.mottoTitle || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}
                    </p>
                    <p className="font-medium text-slate-800 italic text-[10px] mt-0.5">
                      {customInfo.mottoSubTitle || 'Độc lập - Tự do - Hạnh phúc'}
                    </p>
                    <div className="w-24 h-0.5 bg-slate-800 mx-auto mt-1" />
                  </div>
                </div>

                {/* 2. Main Title */}
                <div className="text-center my-4 space-y-1 font-sans">
                  <h3 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-wide">
                    {isPreviewOverall
                      ? (targetClasses.length === session.classes.length
                          ? 'BẢNG KẾT QUẢ ĐIỂM TỔNG HỢP - TOÀN TRƯỜNG'
                          : `BẢNG KẾT QUẢ ĐIỂM TỔNG HỢP - ${targetClasses.length} LỚP ĐƯỢC CHỌN`)
                      : `BẢNG KẾT QUẢ ĐIỂM & THỐNG KÊ CHI TIẾT - LỚP ${previewClass.toUpperCase()}`}
                  </h3>
                  <p className="text-[11px] text-slate-600 font-semibold font-serif italic">
                    Kỳ thi: <span className="text-slate-900 font-sans font-bold">{session.name}</span> | Năm học: {session.academicYear}
                  </p>
                </div>

                {/* 3. Class & Teacher Metadata Banner */}
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-2.5 mb-4 flex flex-wrap items-center justify-between gap-2 font-sans text-xs">
                  {isPreviewOverall ? (
                    <>
                      <div>
                        <span className="text-slate-600 font-medium">Quy mô xuất dữ liệu: </span>
                        <strong className="text-slate-900">Toàn bộ học sinh ({targetClasses.length} lớp)</strong>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700 font-semibold">
                        <span>Sĩ số: <strong className="text-slate-900">{currentClassStudents.length}</strong> HS</span>
                        <span>•</span>
                        <span>Tổng số lớp: <strong className="text-slate-900">{targetClasses.length}</strong></span>
                        <span>•</span>
                        <span>Điểm TB chung: <strong className="text-indigo-800">
                          {currentClassStudents.length > 0 ? (currentClassStudents.reduce((acc, s) => acc + s.averageScore, 0) / currentClassStudents.length).toFixed(2) : '0'}
                        </strong></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-slate-600 font-medium">Giáo viên chủ nhiệm: </span>
                        <strong className="text-slate-900">
                          {currentClassSummary?.homeroomTeacher && !currentClassSummary.homeroomTeacher.includes('Chủ Nhiệm')
                            ? currentClassSummary.homeroomTeacher
                            : '...............................'}
                        </strong>
                      </div>
                      <div className="flex items-center gap-3 text-slate-700 font-semibold">
                        <span>Sĩ số: <strong className="text-slate-900">{currentClassStudents.length}</strong> HS</span>
                        <span>•</span>
                        <span>Khối: <strong className="text-slate-900">{currentClassSummary?.grade || ''}</strong></span>
                        <span>•</span>
                        <span>Điểm TB lớp: <strong className="text-indigo-800">{currentClassSummary?.avgTotalScore || 0}</strong></span>
                      </div>
                    </>
                  )}
                </div>

                {/* 4. PHẦN I: BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN */}
                {config.showSummaryTable && activeCriteriaList.length > 0 && (
                  <div className="mb-5 space-y-1.5 font-sans">
                    <h4 className="font-extrabold text-[11px] text-slate-900 uppercase tracking-wider">
                      {isPreviewOverall
                        ? 'I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN (TOÀN TRƯỜNG)'
                        : 'I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN CỦA LỚP'}
                    </h4>
                    <div className="border border-slate-400 overflow-x-auto">
                      <table className="w-full text-left text-[10px] border-collapse">
                        <thead className="bg-slate-200 border-b border-slate-400 text-slate-900 font-bold uppercase">
                          <tr>
                            <th className="px-2 py-1.5 border border-slate-400">Môn học</th>
                            {activeCriteriaList.map((crit) => (
                              <th key={crit.id} className="px-1.5 py-1.5 text-center border border-slate-400">
                                {crit.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 font-mono">
                          {session.subjects
                            .filter((sub) => config.columns.subjects[sub] !== false)
                            .map((sub) => {
                              const st = isPreviewOverall
                                ? session.overallStats[sub]
                                : currentClassSummary?.subjectStats[sub];
                              if (!st) return null;
                              return (
                                <tr key={sub} className="hover:bg-slate-50">
                                  <td className="px-2 py-1 font-sans font-bold text-slate-900 border border-slate-400">
                                    {sub}
                                  </td>
                                  {config.summaryCriteria.count && (
                                    <td className="px-1.5 py-1 text-center border border-slate-400">{st.count}</td>
                                  )}
                                  {config.summaryCriteria.avgScore && (
                                    <td className="px-1.5 py-1 text-center font-bold text-indigo-800 bg-indigo-50/40 border border-slate-400">
                                      {st.avgScore.toFixed(2)}
                                    </td>
                                  )}
                                  {config.summaryCriteria.maxScore && (
                                    <td className="px-1.5 py-1 text-center font-bold text-emerald-700 border border-slate-400">
                                      {st.maxScore.toFixed(1)}
                                    </td>
                                  )}
                                  {config.summaryCriteria.minScore && (
                                    <td className="px-1.5 py-1 text-center text-slate-600 border border-slate-400">
                                      {st.minScore.toFixed(1)}
                                    </td>
                                  )}
                                  {session.intervals
                                    .filter((inv) => config.summaryCriteria.intervals[inv.id] !== false)
                                    .map((inv) => (
                                      <td key={inv.id} className="px-1 py-1 text-center border border-slate-400">
                                        <span className="font-bold">{st.intervalCounts[inv.id] || 0}</span>
                                        <span className="text-[8px] text-slate-500 block">
                                          {st.intervalPercents[inv.id] || 0}%
                                        </span>
                                      </td>
                                    ))}
                                  {config.summaryCriteria.above5 && (
                                    <>
                                      <td className="px-1.5 py-1 text-center font-bold text-emerald-800 bg-emerald-50/30 border border-slate-400">
                                        {st.above5Count}
                                      </td>
                                      <td className="px-1.5 py-1 text-center font-semibold text-emerald-800 bg-emerald-50/30 border border-slate-400">
                                        {st.above5Percent}%
                                      </td>
                                    </>
                                  )}
                                  {config.summaryCriteria.above8 && (
                                    <>
                                      <td className="px-1.5 py-1 text-center font-bold text-blue-800 bg-blue-50/30 border border-slate-400">
                                        {st.above8Count}
                                      </td>
                                      <td className="px-1.5 py-1 text-center font-semibold text-blue-800 bg-blue-50/30 border border-slate-400">
                                        {st.above8Percent}%
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. PHẦN II: DANH SÁCH CHI TIẾT HỌC SINH */}
                <div className="mb-5 space-y-1.5 font-sans">
                  <h4 className="font-extrabold text-[11px] text-slate-900 uppercase tracking-wider">
                    {isPreviewOverall
                      ? `${config.showSummaryTable ? 'II. ' : ''}DANH SÁCH CHI TIẾT HỌC SINH TẤT CẢ CÁC LỚP (CÓ XẾP THỨ TRƯỜNG & LỚP)`
                      : `${config.showSummaryTable ? 'II. ' : ''}DANH SÁCH CHI TIẾT HỌC SINH LỚP ${previewClass} (CÓ XẾP THỨ LỚP & TRƯỜNG)`}
                  </h4>
                  <div className="border border-slate-400 overflow-x-auto">
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead className="bg-slate-200 border-b border-slate-400 text-slate-900 font-bold uppercase">
                        <tr>
                          {activeStudentColumns.map((col) => (
                            <th
                              key={col.key}
                              className={`px-1.5 py-1.5 border border-slate-400 ${
                                col.align === 'center'
                                  ? 'text-center'
                                  : col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              } ${
                                col.key === 'totalScore'
                                  ? 'bg-indigo-100/70 text-indigo-950'
                                  : col.key === 'classRank'
                                  ? 'bg-emerald-100/70 text-emerald-950'
                                  : col.key === 'schoolRank'
                                  ? 'bg-amber-100/70 text-amber-950'
                                  : ''
                              }`}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 font-mono">
                        {currentClassStudents.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50">
                            {activeStudentColumns.map((col) => {
                              if (col.key === 'stt') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center text-slate-500 border border-slate-400">
                                    {idx + 1}
                                  </td>
                                );
                              }
                              if (col.key === 'sbd') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center font-bold text-slate-800 border border-slate-400">
                                    {st.sbd}
                                  </td>
                                );
                              }
                              if (col.key === 'name') {
                                return (
                                  <td key={col.key} className="px-2 py-1 font-sans font-bold text-slate-950 whitespace-nowrap border border-slate-400">
                                    {st.name}
                                  </td>
                                );
                              }
                              if (col.key === 'dob') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center font-sans text-slate-600 border border-slate-400">
                                    {st.dob || '-'}
                                  </td>
                                );
                              }
                              if (col.key === 'examRoom') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center font-bold text-slate-800 border border-slate-400">
                                    {st.examRoom || '-'}
                                  </td>
                                );
                              }
                              if (col.key === 'gender') {
                                return (
                                  <td key={col.key} className="px-1 py-1 text-center font-sans text-slate-500 border border-slate-400">
                                    {st.gender || '-'}
                                  </td>
                                );
                              }
                              if (col.key === 'className') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center font-bold text-slate-700 border border-slate-400">
                                    {st.className}
                                  </td>
                                );
                              }
                              if (col.key === 'grade') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center text-slate-600 border border-slate-400">
                                    {st.grade || '-'}
                                  </td>
                                );
                              }
                              if (col.key.startsWith('sub_')) {
                                const sub = col.key.replace('sub_', '');
                                const sc = st.scores[sub];
                                const isNull = sc === null || sc === undefined;
                                const isLow = typeof sc === 'number' && sc < 5.0;
                                const isHigh = typeof sc === 'number' && sc >= 8.0;

                                return (
                                  <td
                                    key={col.key}
                                    className={`px-1.5 py-1 text-center border border-slate-400 ${
                                      isNull
                                        ? 'text-slate-300'
                                        : isLow
                                        ? 'text-red-600 font-bold'
                                        : isHigh
                                        ? 'text-emerald-700 font-bold'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {isNull ? '-' : sc.toFixed(1)}
                                  </td>
                                );
                              }
                              if (col.key === 'totalScore') {
                                return (
                                  <td key={col.key} className="px-2 py-1 text-right font-bold text-indigo-900 bg-indigo-50/30 border border-slate-400">
                                    {st.totalScore.toFixed(2)}
                                  </td>
                                );
                              }
                              if (col.key === 'averageScore') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-right font-semibold text-slate-800 border border-slate-400">
                                    {st.averageScore.toFixed(2)}
                                  </td>
                                );
                              }
                              if (col.key === 'classRank') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center font-black text-emerald-800 bg-emerald-50/40 border border-slate-400">
                                    #{st.classRank}
                                  </td>
                                );
                              }
                              if (col.key === 'schoolRank') {
                                return (
                                  <td key={col.key} className="px-1.5 py-1 text-center font-bold text-amber-800 bg-amber-50/40 border border-slate-400">
                                    #{st.schoolRank}
                                  </td>
                                );
                              }
                              if (col.key === 'notes') {
                                return (
                                  <td key={col.key} className="px-2 py-1 font-sans text-slate-500 border border-slate-400">
                                    {st.notes || ''}
                                  </td>
                                );
                              }
                              return <td key={col.key} className="border border-slate-400" />;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 6. Chữ ký chuẩn có hỗ trợ ảnh chữ ký và con dấu */}
                {config.showSignatures && (
                  <div className="pt-4 font-serif text-xs">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="h-5 mb-1" />
                        <p className="font-bold text-slate-900 uppercase text-[10.5px]">
                          {customInfo.subjectTeacherTitle || 'GIÁO VIÊN BỘ MÔN'}
                        </p>
                        <p className="text-[9.5px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                        <div className="h-12 flex items-center justify-center my-1">
                          {customInfo.subjectTeacherSignatureImage && (
                            <img
                              src={customInfo.subjectTeacherSignatureImage}
                              alt="Chữ ký GVBM"
                              className="max-h-12 max-w-[120px] object-contain"
                            />
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-[11px] min-h-[16px]">
                          {customInfo.subjectTeacherName || ''}
                        </p>
                      </div>
                      <div>
                        <div className="h-5 mb-1" />
                        <p className="font-bold text-slate-900 uppercase text-[10.5px]">
                          {isPreviewOverall
                            ? 'TỔ TRƯỞNG CHUYÊN MÔN'
                            : customInfo.homeroomTeacherTitle || 'GIÁO VIÊN CHỦ NHIỆM'}
                        </p>
                        <p className="text-[9.5px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                        <div className="h-12 flex items-center justify-center my-1">
                          {customInfo.homeroomTeacherSignatureImage && (
                            <img
                              src={customInfo.homeroomTeacherSignatureImage}
                              alt="Chữ ký GVCN"
                              className="max-h-12 max-w-[120px] object-contain"
                            />
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-[11px] min-h-[16px]">
                          {customInfo.homeroomTeacherName ||
                            (!isPreviewOverall &&
                            currentClassSummary?.homeroomTeacher &&
                            !currentClassSummary.homeroomTeacher.includes('Chủ Nhiệm')
                              ? currentClassSummary.homeroomTeacher
                              : '')}
                        </p>
                      </div>
                      <div>
                        <div className="h-5 mb-1 text-slate-700 italic text-[10px] leading-5">
                          {customInfo.signDate || 'Ngày ..... tháng ..... năm 20....'}
                        </div>
                        <p className="font-bold text-slate-900 uppercase text-[10.5px]">
                          {customInfo.headmasterTitle || 'BAN GIÁM HIỆU'}
                        </p>
                        <p className="text-[9.5px] text-slate-500 italic mt-0.5">(Ký, đóng dấu)</p>
                        <div className="h-12 flex items-center justify-center my-1">
                          {customInfo.headmasterSignatureImage && (
                            <img
                              src={customInfo.headmasterSignatureImage}
                              alt="Con dấu / Chữ ký nhà trường"
                              className="max-h-12 max-w-[120px] object-contain"
                            />
                          )}
                        </div>
                        <p className="font-bold text-slate-900 text-[11px] min-h-[16px]">
                          {customInfo.headmasterName || ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="hidden sm:inline">
              File Excel xuất ra đã được kẻ viền ô, căn chỉnh vừa khít trang in theo hướng <strong>{config.orientation === 'landscape' ? 'Ngang' : 'Dọc'}</strong>
              {(customInfo.subjectTeacherSignatureImage || customInfo.homeroomTeacherSignatureImage || customInfo.headmasterSignatureImage) && (
                <> và <strong className="text-emerald-700">tự động nhúng ảnh chữ ký / con dấu</strong></>
              )}.
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-xl transition-colors"
            >
              Đóng
            </button>

            {/* In trực tiếp máy in mặc định */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-98"
              title="In trực tiếp bằng Máy in mặc định của máy tính hoặc Lưu PDF"
            >
              <Printer className="w-4 h-4 text-emerald-300" />
              <span>{isPrinting ? 'Đang gửi lệnh in...' : 'In Ngay (Máy In Mặc Định)'}</span>
            </button>

            {/* Xuất Excel chuẩn trang in */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isExportingExcel}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-200 transition-all active:scale-98 disabled:opacity-60"
              title="Tải tệp Excel đã định dạng chuẩn trang in, kẻ viền ô, căn chỉnh tiêu đề và nhúng chữ ký/dấu"
            >
              <Download className="w-4 h-4 text-emerald-100" />
              <span>{isExportingExcel ? 'Đang tạo tệp Excel...' : 'Xuất Danh Sách Điểm Thi (.xlsx) Chuẩn Trang In'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
