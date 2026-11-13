import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  SlidersHorizontal,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  School,
  FileSpreadsheet,
  Files,
  FilePlus2,
  Layers,
  Info
} from 'lucide-react';
import { ScoreInterval, StatisticSession } from '../types';
import { 
  DEFAULT_10_INTERVALS, 
  MOET_RANKING_INTERVALS, 
  PASS_FAIL_INTERVALS, 
  processStudentData 
} from '../services/sampleData';
import { parseExcelFile, ParsedExcelResult } from '../services/excelService';
import { saveSession } from '../services/storage';

interface NewStatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (session: StatisticSession) => void;
}

export interface LoadedFileInfo {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  rawRowsCount: number;
  recognizedSubjects: string[];
  classes: string[];
  missingColumns: string[];
  extractedStudents: ParsedExcelResult['extractedStudents'];
}

export const NewStatModal: React.FC<NewStatModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
}) => {
  const [sessionName, setSessionName] = useState('Thống kê - Kiểm tra giữa học kỳ 1 - năm học 2026-2027');
  const [schoolName, setSchoolName] = useState('Trường THCS Thư Vũ');
  const [academicYear, setAcademicYear] = useState('2026 - 2027');

  // Multi-file parsing states
  const [loadedFiles, setLoadedFiles] = useState<LoadedFileInfo[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Criteria intervals
  const [selectedPreset, setSelectedPreset] = useState<'standard_10' | 'moet' | 'pass_fail' | 'custom'>('standard_10');
  const [intervals, setIntervals] = useState<ScoreInterval[]>(DEFAULT_10_INTERVALS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreFileInputRef = useRef<HTMLInputElement>(null);

  // Reset completely every time modal opens to ensure clean, from-scratch creation
  useEffect(() => {
    if (isOpen) {
      setLoadedFiles([]);
      setParseError(null);
      setIsParsing(false);
      setParsingStatus('');
      setSessionName('Thống kê - Kiểm tra giữa học kỳ 1 - năm học 2026-2027');
      setSchoolName('Trường THCS Thư Vũ');
      setAcademicYear('2026 - 2027');
      setIntervals(DEFAULT_10_INTERVALS);
      setSelectedPreset('standard_10');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (addMoreFileInputRef.current) addMoreFileInputRef.current.value = '';
    }
  }, [isOpen]);

  // Presets switcher
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
  };

  const handleDeleteInterval = (index: number) => {
    if (intervals.length <= 1) return;
    setIntervals(intervals.filter((_, i) => i !== index));
  };

  // Process adding multiple files
  const handleFilesAdd = async (filesToAdd: File[]) => {
    if (!filesToAdd || filesToAdd.length === 0) return;
    setIsParsing(true);
    setParseError(null);

    const newlyLoaded: LoadedFileInfo[] = [];
    const errors: string[] = [];

    for (let i = 0; i < filesToAdd.length; i++) {
      const file = filesToAdd[i];
      setParsingStatus(`Đang đọc tệp (${i + 1}/${filesToAdd.length}): ${file.name}...`);

      // Check duplicate
      const isAlreadyLoaded = loadedFiles.some(
        (existing) => existing.fileName === file.name && existing.fileSize === file.size
      ) || newlyLoaded.some(
        (existing) => existing.fileName === file.name && existing.fileSize === file.size
      );

      if (isAlreadyLoaded) {
        errors.push(`Tệp "${file.name}" đã có trong danh sách nạp, đã bỏ qua để tránh trùng.`);
        continue;
      }

      try {
        const res = await parseExcelFile(file);
        const classes = Array.from(new Set(res.extractedStudents.map((s) => s.className).filter(Boolean)));
        
        newlyLoaded.push({
          id: `${file.name}_${file.size}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          fileName: file.name,
          fileSize: file.size,
          rawRowsCount: res.rawRowsCount,
          recognizedSubjects: res.recognizedSubjects,
          classes,
          missingColumns: res.missingColumns,
          extractedStudents: res.extractedStudents,
        });

        // Auto-detect school name if not customized
        const detectedSchool = res.extractedStudents.find((s) => s.school)?.school;
        if (detectedSchool && (!schoolName || schoolName === 'Trường THCS Thư Vũ' || schoolName === 'Trường THPT Chuyên Chu Văn An')) {
          setSchoolName(detectedSchool);
        }
      } catch (err: any) {
        errors.push(`Lỗi khi đọc file "${file.name}": ${err.message || 'Không đúng định dạng Excel'}`);
      }
    }

    if (newlyLoaded.length > 0) {
      setLoadedFiles((prev) => {
        const updated = [...prev, ...newlyLoaded];
        // Auto-suggest session name if default
        if (sessionName === 'Thống Kê Điểm Khảo Sát Học Kỳ 1') {
          if (updated.length === 1) {
            const cleanName = updated[0].fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
            setSessionName(`Thống kê - ${cleanName}`);
          } else {
            setSessionName(`Thống kê gộp ${updated.length} tệp điểm thi`);
          }
        }
        return updated;
      });
    }

    if (errors.length > 0) {
      setParseError(errors.join('\n'));
    }

    setIsParsing(false);
    setParsingStatus('');
  };

  const handleRemoveFile = (id: string) => {
    setLoadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdd(Array.from(e.dataTransfer.files));
    }
  };

  // Intelligent Merging of loaded files into a single unified dataset
  const mergedData = useMemo(() => {
    if (loadedFiles.length === 0) return null;

    // Collect all unique subjects across all files
    const allSubjects: string[] = [];
    loadedFiles.forEach((f) => {
      f.recognizedSubjects.forEach((sub) => {
        if (!allSubjects.includes(sub)) {
          allSubjects.push(sub);
        }
      });
    });

    // Collect all unique classes
    const allClasses: string[] = [];
    loadedFiles.forEach((f) => {
      f.classes.forEach((c) => {
        if (!allClasses.includes(c)) {
          allClasses.push(c);
        }
      });
    });

    // Merge students intelligently:
    // If student has explicit SBD, merge subject scores if duplicate
    // Otherwise concatenate
    const studentMap = new Map<string, ParsedExcelResult['extractedStudents'][0]>();
    let duplicateMergedCount = 0;

    loadedFiles.forEach((f) => {
      f.extractedStudents.forEach((st) => {
        const isGenericSbd = !st.sbd || /^SBD0*\d+$/i.test(st.sbd) || st.sbd.startsWith('SBD_');
        const studentKey = !isGenericSbd
          ? `sbd_${st.sbd.trim().toLowerCase()}`
          : `name_${st.name.trim().toLowerCase()}_lop_${st.className.trim().toLowerCase()}`;

        if (studentMap.has(studentKey)) {
          const existing = studentMap.get(studentKey)!;
          existing.scores = {
            ...existing.scores,
            ...st.scores,
          };
          if (!existing.dob && st.dob) existing.dob = st.dob;
          if (!existing.gender && st.gender) existing.gender = st.gender;
          if (!existing.examRoom && st.examRoom) existing.examRoom = st.examRoom;
          duplicateMergedCount++;
        } else {
          studentMap.set(studentKey, {
            ...st,
            scores: { ...st.scores },
          });
        }
      });
    });

    const mergedStudents = Array.from(studentMap.values()).map((st, idx) => ({
      ...st,
      stt: idx + 1, // Sequential STT across combined cohort
    }));

    const totalSize = loadedFiles.reduce((sum, f) => sum + f.fileSize, 0);
    const summaryFileName = loadedFiles.length === 1
      ? loadedFiles[0].fileName
      : `Gộp ${loadedFiles.length} tệp (${loadedFiles.map((f) => f.fileName).join(', ')})`;

    const missingColsSet = new Set<string>();
    loadedFiles.forEach((f) => f.missingColumns.forEach((m) => missingColsSet.add(m)));

    return {
      totalStudents: mergedStudents.length,
      allSubjects,
      allClasses,
      totalSize,
      summaryFileName,
      mergedStudents,
      duplicateMergedCount,
      missingColumns: Array.from(missingColsSet),
    };
  }, [loadedFiles]);

  const handleProcessSubmit = async () => {
    if (!sessionName.trim()) {
      alert('Vui lòng đặt tên cho lần thống kê này!');
      return;
    }

    if (!mergedData || mergedData.mergedStudents.length === 0) {
      alert('Vui lòng chọn hoặc tải lên ít nhất một tệp Excel có chứa dữ liệu học sinh!');
      return;
    }

    // Process merged data into complete session
    const session = processStudentData(
      mergedData.mergedStudents,
      sessionName.trim(),
      schoolName.trim() || 'Trường THPT',
      academicYear.trim() || '2025 - 2026',
      intervals,
      mergedData.summaryFileName,
      mergedData.totalSize
    );

    // Save permanently in IndexedDB
    await saveSession(session);

    // Trigger parent callback
    onSessionCreated(session);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Tạo Lần Thống Kê Mới (Tạo Mới Từ Đầu)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Độc Lập 100%
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tạo một đợt thống kê hoàn toàn mới từ tệp Excel. Không nạp thêm hoặc ảnh hưởng đến dữ liệu đợt thống kê đang xem.
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

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Thông báo tạo mới độc lập */}
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-indigo-900">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Lưu ý về tạo lần thống kê mới:</span>
              <p className="text-indigo-800 leading-relaxed">
                Chức năng này dùng để <strong>tạo mới từ đầu</strong> một đợt thống kê độc lập từ tệp Excel tải lên. Đợt thống kê này được lưu thành bản ghi mới, hoàn toàn không nạp gộp hay làm mất dữ liệu của đợt thống kê hiện tại. Nếu muốn sửa hoặc thay file cho đợt thống kê hiện tại, quý thầy/cô vui lòng dùng nút <strong>"Sửa / Cập nhật dữ liệu"</strong>.
              </p>
            </div>
          </div>

          {/* 1. Tên lần thống kê & Thông tin chung */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">
                1
              </span>
              Thông Tin Lần Thống Kê
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên cho lần thống kê này <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="VD: Khảo sát chất lượng Giữa Kỳ 1 - Khối 10"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Năm học
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2025 - 2026"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Trường / Đơn vị tổ chức
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Trường THCS Thư Vũ"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* 2. Tải nhiều tệp kết quả học tập & Nạp thêm tệp */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">
                  2
                </span>
                Tải Tệp Kết Quả Học Tập (Hỗ trợ tải nhiều tệp)
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Tự động gộp thành 1 tệp dữ liệu
                </span>
                {loadedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => addMoreFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-95"
                    title="Bấm để chọn và nạp thêm các tệp Excel khác vào đợt thống kê này"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nạp thêm tệp</span>
                  </button>
                )}
              </div>
            </div>

            {/* Hidden Input for Initial or Direct Selection */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesAdd(Array.from(e.target.files));
                }
              }}
              className="hidden"
            />

            {/* Hidden Input for "Nạp thêm tệp" Button */}
            <input
              ref={addMoreFileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesAdd(Array.from(e.target.files));
                  e.target.value = ''; // Reset input to allow re-selecting same file if re-added
                }
              }}
              className="hidden"
            />

            {/* Main Upload Dropzone or Loaded File List */}
            {loadedFiles.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/60 hover:bg-indigo-50/20 rounded-xl p-6 text-center cursor-pointer transition-all"
              >
                {isParsing ? (
                  <div className="py-4 flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-700 font-semibold">{parsingStatus || 'Đang phân tích cấu trúc file Excel...'}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Kéo thả các file Excel vào đây hoặc <span className="text-indigo-600 underline">bấm để chọn file</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Bạn có thể chọn cùng lúc một hoặc <strong>nhiều tệp Excel (.xlsx, .xls)</strong> của từng lớp/khối
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Chấp nhận file thiếu cột • Hệ thống sẽ tự động bù trừ dữ liệu
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* List of Loaded Files */}
                <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                    <span className="flex items-center gap-1.5">
                      <Files className="w-4 h-4 text-indigo-600" />
                      Danh sách các tệp đã nạp ({loadedFiles.length} tệp):
                    </span>
                    <button
                      type="button"
                      onClick={() => addMoreFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nạp thêm tệp</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {loadedFiles.map((f, idx) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate text-[11.5px]" title={f.fileName}>
                              {f.fileName}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500 mt-0.5">
                              <span>{(f.fileSize / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span className="font-semibold text-emerald-700">
                                {f.rawRowsCount} học sinh
                              </span>
                              {f.classes.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600">Lớp: {f.classes.join(', ')}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="text-indigo-600 font-medium">{f.recognizedSubjects.length} môn</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFile(f.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2 shrink-0"
                          title="Xóa tệp này khỏi danh sách nạp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Nút "Nạp thêm tệp" lớn, rõ ràng */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => addMoreFileInputRef.current?.click()}
                      className="w-full py-2.5 px-3 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50/90 rounded-lg text-indigo-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                    >
                      <FilePlus2 className="w-4 h-4" />
                      <span>Nạp thêm tệp kết quả học tập từ máy tính</span>
                    </button>
                  </div>
                </div>

                {/* Parsing indicator when adding more */}
                {isParsing && (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 text-xs text-indigo-700 font-medium">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>{parsingStatus || 'Đang phân tích và xử lý thêm tệp Excel...'}</span>
                  </div>
                )}

                {/* Combined & Merged Data Summary Banner */}
                {mergedData && (
                  <div className="p-4 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-indigo-50/80 border border-emerald-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-1 text-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-950">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Tự động gộp thành 1 tệp dữ liệu duy nhất:</span>
                      </div>
                      <span className="text-emerald-800 font-extrabold bg-white/80 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                        Tổng cộng {mergedData.totalStudents} học sinh
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-500 block">Số tệp đã nạp</span>
                        <strong className="text-slate-800 text-sm">{loadedFiles.length} tệp</strong>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-500 block">Số lớp phân tách</span>
                        <strong className="text-indigo-700 text-sm">{mergedData.allClasses.length} lớp</strong>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-500 block">Số môn thi</span>
                        <strong className="text-emerald-700 text-sm">{mergedData.allSubjects.length} môn</strong>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-500 block">Tổng dung lượng</span>
                        <strong className="text-slate-800 text-sm">{(mergedData.totalSize / 1024).toFixed(1)} KB</strong>
                      </div>
                    </div>

                    {/* Classes badge */}
                    {mergedData.allClasses.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        <span className="text-slate-600 font-semibold text-[11px]">Các lớp được tách:</span>
                        {mergedData.allClasses.map((cls) => (
                          <span key={cls} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-bold text-[11px]">
                            Lớp {cls}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Subjects badge */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                      <span className="text-slate-600 font-semibold text-[11px]">Môn thi tổng hợp:</span>
                      {mergedData.allSubjects.map((sub) => (
                        <span key={sub} className="px-2 py-0.5 bg-white/90 border border-slate-200 rounded text-slate-700 font-medium text-[11px]">
                          {sub}
                        </span>
                      ))}
                    </div>

                    {/* Deduplication or tolerance notice */}
                    {mergedData.duplicateMergedCount > 0 && (
                      <div className="text-[11px] text-indigo-800 bg-indigo-50/70 p-2 rounded-lg border border-indigo-200 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Đã tự động gộp điểm cho {mergedData.duplicateMergedCount} học sinh có cùng SBD/Họ tên từ các tệp khác nhau.</span>
                      </div>
                    )}

                    {mergedData.missingColumns.length > 0 ? (
                      <div className="text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          Một số file thiếu cột ({mergedData.missingColumns.join(', ')}). Hệ thống đã tự động bù trừ dữ liệu mặc định.
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Dữ liệu các tệp đã sẵn sàng để thống kê toàn diện và xuất báo cáo tách sheet cho từng lớp.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {parseError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 whitespace-pre-line">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>{parseError}</p>
              </div>
            )}
          </div>

          {/* 3. Cấu hình tiêu chí thống kê (mốc điểm) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px]">
                3
              </span>
              Chọn Tiêu Chí & Các Mốc Thống Kê Điểm
            </h4>

            {/* Presets switcher */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handlePresetChange('standard_10')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all text-left ${
                  selectedPreset === 'standard_10'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs'
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
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs'
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
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs'
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
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="font-bold">Tùy Biến Dải Điểm</div>
                <div className="text-[10px] text-slate-500">Tự do chỉnh sửa mốc</div>
              </button>
            </div>

            {/* Interval rows */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 space-y-2 max-h-52 overflow-y-auto">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 px-2 pb-1 border-b border-slate-200">
                <span className="col-span-5">Tên mốc hiển thị</span>
                <span className="col-span-3">Từ điểm (≥)</span>
                <span className="col-span-3">Đến điểm (&lt;)</span>
                <span className="col-span-1 text-center">Xóa</span>
              </div>

              {intervals.map((inv, idx) => (
                <div key={inv.id} className="grid grid-cols-12 gap-2 items-center bg-white p-1.5 rounded-lg border border-slate-200 text-xs">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={inv.label}
                      onChange={(e) => handleUpdateInterval(idx, { label: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-medium"
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
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
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
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteInterval(idx)}
                      disabled={intervals.length <= 1}
                      className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddCustomInterval}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm mốc điểm mới</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleProcessSubmit}
            disabled={!mergedData || mergedData.mergedStudents.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-400 disabled:to-slate-400 text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-300 disabled:shadow-none transition-all active:scale-[0.98]"
          >
            <span>Thực hiện thống kê & Tách lớp ({mergedData?.totalStudents || 0} HS)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
