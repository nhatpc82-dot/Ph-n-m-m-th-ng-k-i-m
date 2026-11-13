import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Edit3,
  UploadCloud,
  FileCheck2,
  FileSpreadsheet,
  AlertTriangle,
  SlidersHorizontal,
  Plus,
  Trash2,
  CheckCircle2,
  School,
  Calendar,
  Layers,
  Save,
  RotateCcw,
  Download,
  Info
} from 'lucide-react';
import { ScoreInterval, StatisticSession } from '../types';
import { 
  DEFAULT_10_INTERVALS, 
  MOET_RANKING_INTERVALS, 
  PASS_FAIL_INTERVALS, 
  processStudentData 
} from '../services/sampleData';
import { parseExcelFile, downloadSampleStudentExcel, ParsedExcelResult } from '../services/excelService';
import { updateSession } from '../services/storage';

interface EditStatModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StatisticSession | null;
  onSessionUpdated: (updatedSession: StatisticSession) => void;
}

export const EditStatModal: React.FC<EditStatModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionUpdated,
}) => {
  if (!isOpen || !session) return null;

  // 1. Info fields
  const [sessionName, setSessionName] = useState(session.name);
  const [schoolName, setSchoolName] = useState(session.schoolName);
  const [academicYear, setAcademicYear] = useState(session.academicYear);

  // 2. Excel file replacement states
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newParsedResult, setNewParsedResult] = useState<ParsedExcelResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3. Criteria & intervals
  const [intervals, setIntervals] = useState<ScoreInterval[]>(session.intervals || DEFAULT_10_INTERVALS);
  const [selectedPreset, setSelectedPreset] = useState<'standard_10' | 'moet' | 'pass_fail' | 'custom'>('custom');

  // Detect preset from initial session
  useEffect(() => {
    if (session) {
      setSessionName(session.name);
      setSchoolName(session.schoolName);
      setAcademicYear(session.academicYear);
      setIntervals(session.intervals || DEFAULT_10_INTERVALS);
      setNewFile(null);
      setNewParsedResult(null);
      setParseError(null);

      // Check preset
      const currentInts = session.intervals || [];
      if (currentInts.length === 10 && currentInts[0].id === 'int_0_1') {
        setSelectedPreset('standard_10');
      } else if (currentInts.some((i) => i.id.startsWith('moet_'))) {
        setSelectedPreset('moet');
      } else if (currentInts.some((i) => i.id.startsWith('pf_'))) {
        setSelectedPreset('pass_fail');
      } else {
        setSelectedPreset('custom');
      }
    }
  }, [session, isOpen]);

  // Handle Preset Switch
  const handlePresetChange = (preset: 'standard_10' | 'moet' | 'pass_fail' | 'custom') => {
    setSelectedPreset(preset);
    if (preset === 'standard_10') setIntervals(DEFAULT_10_INTERVALS);
    else if (preset === 'moet') setIntervals(MOET_RANKING_INTERVALS);
    else if (preset === 'pass_fail') setIntervals(PASS_FAIL_INTERVALS);
  };

  const handleAddCustomInterval = () => {
    const newId = `custom_${Date.now()}`;
    setIntervals([
      ...intervals,
      { id: newId, label: 'Mốc mới', min: 5.0, max: 7.0, color: '#3b82f6' },
    ]);
  };

  const handleUpdateInterval = (index: number, updated: Partial<ScoreInterval>) => {
    const list = [...intervals];
    list[index] = { ...list[index], ...updated };
    setIntervals(list);
    setSelectedPreset('custom');
  };

  const handleRemoveInterval = (index: number) => {
    if (intervals.length <= 1) {
      alert('Phải có ít nhất 1 mốc thống kê điểm!');
      return;
    }
    const list = [...intervals];
    list.splice(index, 1);
    setIntervals(list);
    setSelectedPreset('custom');
  };

  // Handle Excel File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    await processSelectedFile(file);
  };

  const processSelectedFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    try {
      const res = await parseExcelFile(file);
      if (res.extractedStudents.length === 0) {
        throw new Error('Tệp không có dữ liệu học sinh hoặc bảng điểm hợp lệ.');
      }
      setNewFile(file);
      setNewParsedResult(res);

      // Auto-detect school name if found
      const detectedSchool = res.extractedStudents.find((s) => s.school)?.school;
      if (detectedSchool && !schoolName) {
        setSchoolName(detectedSchool);
      }
    } catch (err: any) {
      setParseError(err.message || 'Không thể đọc tệp Excel. Vui lòng kiểm tra lại định dạng.');
      setNewFile(null);
      setNewParsedResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleCancelNewFile = () => {
    setNewFile(null);
    setNewParsedResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save updates
  const handleSave = async () => {
    if (!sessionName.trim()) {
      alert('Vui lòng nhập tên lần thống kê!');
      return;
    }

    if (intervals.length === 0) {
      alert('Vui lòng cấu hình ít nhất 1 mốc thống kê điểm!');
      return;
    }

    try {
      // Collect existing homeroom teachers map to preserve teacher names
      const existingTeachers: Record<string, string> = {};
      if (session.classSummaries) {
        Object.entries(session.classSummaries).forEach(([cName, cSummary]) => {
          if (cSummary.homeroomTeacher) {
            existingTeachers[cName] = cSummary.homeroomTeacher;
          }
        });
      }

      // Determine students source: new Excel file or existing students
      const rawStudents = newParsedResult
        ? newParsedResult.extractedStudents
        : session.students;

      const finalFileName = newFile ? newFile.name : session.fileName;
      const finalFileSize = newFile ? newFile.size : session.fileSize;

      // Recalculate complete statistical session with updated params
      const updatedSession = processStudentData(
        rawStudents,
        sessionName.trim(),
        schoolName.trim() || 'Trường THCS Thư Vũ',
        academicYear.trim() || '2026 - 2027',
        intervals,
        finalFileName,
        finalFileSize,
        session.id,
        existingTeachers,
        session.createdAt
      );

      // Persist to IndexedDB
      await updateSession(updatedSession);

      // Notify parent
      onSessionUpdated(updatedSession);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi cập nhật đợt thống kê:', err);
      alert('Có lỗi xảy ra khi lưu cập nhật: ' + (err.message || 'Vui lòng thử lại'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-200">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Chỉnh Sửa & Cập Nhật Dữ Liệu Thống Kê
              </h3>
              <p className="text-xs text-slate-500">
                Cập nhật thông tin tên kỳ thi, thay thế file Excel điểm số mới và chọn lại tiêu chí / mốc thống kê điểm
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

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Cập nhật thông tin tên */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[11px] font-bold">
                1
              </span>
              Cập Nhật Lại Thông Tin & Tên Kỳ Thống Kê
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-12">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên lần thống kê / Kỳ kiểm tra: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
                  placeholder="Ví dụ: Thống kê - Kiểm tra giữa học kỳ 1"
                />
              </div>

              <div className="md:col-span-7">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên đơn vị / Trường học:
                </label>
                <div className="relative">
                  <School className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full pl-9.5 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Trường THCS Thư Vũ"
                  />
                </div>
              </div>

              <div className="md:col-span-5">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Năm học:
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full pl-9.5 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="2026 - 2027"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Cập nhật lại tệp kết quả học tập */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[11px] font-bold">
                  2
                </span>
                Cập Nhật Lại Tệp Kết Quả Học Tập (Excel)
              </h4>
              <button
                type="button"
                onClick={downloadSampleStudentExcel}
                className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải tệp mẫu Excel</span>
              </button>
            </div>

            {/* Current file card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Tệp hiện hành: {session.fileName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-mono">
                        {(session.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Dữ liệu đang dùng: <strong>{session.students.length}</strong> học sinh •{' '}
                      <strong>{session.classes.length}</strong> lớp ({session.classes.join(', ')}) •{' '}
                      <strong>{session.subjects.length}</strong> môn thi
                    </div>
                  </div>
                </div>

                {!newFile && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Thay tệp Excel khác</span>
                  </button>
                )}
              </div>

              {/* If a new file is loaded */}
              {newFile && newParsedResult && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Đã chọn tệp Excel mới: {newFile.name} ({(newFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelNewFile}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Hủy, giữ tệp cũ</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1 pl-6">
                    Đã đọc thành công: <strong>{newParsedResult.extractedStudents.length}</strong> học sinh,{' '}
                    <strong>{Array.from(new Set(newParsedResult.extractedStudents.map((s) => s.className))).length}</strong> lớp,{' '}
                    <strong>{newParsedResult.recognizedSubjects.length}</strong> môn thi ({newParsedResult.recognizedSubjects.join(', ')}).
                  </div>
                </div>
              )}

              {/* Parsing status / error */}
              {isParsing && (
                <div className="p-2 text-xs text-amber-700 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                  <span>Đang phân tích dữ liệu tệp Excel mới...</span>
                </div>
              )}

              {parseError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* 3. Cập nhật lại chọn tiêu chí & các mốc thống kê điểm */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[11px] font-bold">
                3
              </span>
              Cập Nhật Lại Tiêu Chí & Các Mốc Thống Kê Điểm
            </h4>

            {/* Presets switcher */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handlePresetChange('standard_10')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                  selectedPreset === 'standard_10'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="font-bold">10 Mốc Chi Tiết</div>
                <div className="text-[10px] text-slate-500">0-1, 1-2, ..., 9-10</div>
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('moet')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                  selectedPreset === 'moet'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="font-bold">Chuẩn Bộ GD&ĐT</div>
                <div className="text-[10px] text-slate-500">Kém, Yếu, TB, Khá, Giỏi</div>
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('pass_fail')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                  selectedPreset === 'pass_fail'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="font-bold">Đạt / Chưa Đạt</div>
                <div className="text-[10px] text-slate-500">&lt;5.0, 5.0-8.0, ≥8.0</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset('custom')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                  selectedPreset === 'custom'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="font-bold">Tùy Biến Dải Điểm</div>
                <div className="text-[10px] text-slate-500">Tự do chỉnh sửa mốc</div>
              </button>
            </div>

            {/* Intervals table */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2 max-h-52 overflow-y-auto">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 px-2 pb-1 border-b border-slate-200">
                <span className="col-span-5">Tên mốc hiển thị</span>
                <span className="col-span-3">Từ điểm (≥)</span>
                <span className="col-span-3">Đến điểm (&lt;)</span>
                <span className="col-span-1 text-center">Xóa</span>
              </div>

              {intervals.map((inv, idx) => (
                <div key={inv.id || idx} className="grid grid-cols-12 gap-2 items-center bg-white p-1.5 rounded-lg border border-slate-200 text-xs">
                  <div className="col-span-5 flex items-center gap-1.5">
                    <input
                      type="color"
                      value={inv.color || '#3b82f6'}
                      onChange={(e) => handleUpdateInterval(idx, { color: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0 shrink-0"
                      title="Chọn màu mốc điểm"
                    />
                    <input
                      type="text"
                      value={inv.label}
                      onChange={(e) => handleUpdateInterval(idx, { label: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-amber-500 font-medium"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={inv.min}
                      onChange={(e) => handleUpdateInterval(idx, { min: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={inv.max}
                      onChange={(e) => handleUpdateInterval(idx, { max: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveInterval(idx)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                      title="Xóa mốc này"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleAddCustomInterval}
                  className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm mốc điểm mới</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-200 transition-all hover:scale-[1.01]"
          >
            <Save className="w-4 h-4" />
            <span>Lưu & Cập Nhật Dữ Liệu Thống Kê</span>
          </button>
        </div>
      </div>
    </div>
  );
};
