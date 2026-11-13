import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  FileText,
  Sliders,
  CheckCircle2,
  Copy,
  Layers,
  Settings2,
  Sparkles,
  Info,
  Maximize2
} from 'lucide-react';
import { StatisticSession, Student } from '../types';
import { printHTML } from '../services/printService';

interface PrintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StatisticSession;
  selectedClass: string;
}

export const PrintConfigModal: React.FC<PrintConfigModalProps> = ({
  isOpen,
  onClose,
  session,
  selectedClass,
}) => {
  // Print configuration settings
  const [printScope, setPrintScope] = useState<'current' | 'all'>('current');
  const [paperSize, setPaperSize] = useState<'a4' | 'a3' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [scalePercent, setScalePercent] = useState<number>(85);
  const [copies, setCopies] = useState<number>(1);
  const [repeatHeaderOnEveryPage, setRepeatHeaderOnEveryPage] = useState<boolean>(true);
  const [showSummaryTable, setShowSummaryTable] = useState<boolean>(true);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  if (!isOpen) return null;

  const targetClasses = printScope === 'current' ? [selectedClass] : session.classes;

  const generatePrintableHTML = () => {
    let classesHTML = '';

    targetClasses.forEach((cName, cIdx) => {
      const classSummary = session.classSummaries[cName];
      const classStudents = session.students
        .filter((s) => s.className === cName)
        .sort((a, b) => a.classRank - b.classRank);

      const isLast = cIdx === targetClasses.length - 1;

      classesHTML += `
        <div class="class-report-page ${!isLast ? 'page-break' : ''}">
          <!-- Header -->
          <div class="header-grid">
            <div class="header-left">
              <div class="sub-title">SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
              <div class="school-title">${session.schoolName.trim().toUpperCase().startsWith('TRƯỜNG:') ? session.schoolName.trim().toUpperCase() : `TRƯỜNG: ${session.schoolName.trim().toUpperCase()}`}</div>
              <div class="doc-sub">Đơn vị lưu trữ hồ sơ khảo sát</div>
            </div>
            <div class="header-right">
              <div class="motto-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="motto-sub">Độc lập - Tự do - Hạnh phúc</div>
              <div class="motto-line"></div>
            </div>
          </div>

          <!-- Title -->
          <div class="main-title-block">
            <h1 class="main-title">BẢNG KẾT QUẢ ĐIỂM & THỐNG KÊ CHI TIẾT - LỚP ${cName.toUpperCase()}</h1>
            <div class="meta-title">Kỳ thi: <strong>${session.name}</strong> | Năm học: <strong>${session.academicYear}</strong></div>
          </div>

          <!-- Class info -->
          <div class="class-meta-box">
            <div>Giáo viên chủ nhiệm: <strong>${classSummary?.homeroomTeacher || '...............................'}</strong></div>
            <div>Sĩ số: <strong>${classStudents.length}</strong> học sinh | Khối: <strong>${classSummary?.grade || ''}</strong> | Điểm TB lớp: <strong>${classSummary?.avgTotalScore || 0}</strong></div>
          </div>

          ${
            showSummaryTable
              ? `
          <!-- I. Bảng thống kê -->
          <div class="section-title">I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN CỦA LỚP</div>
          <table class="report-table summary-table">
            <thead>
              <tr>
                <th style="width: 100px;">Môn học</th>
                <th style="width: 40px;">Số bài</th>
                <th style="width: 50px;">Điểm TB</th>
                <th style="width: 40px;">Max</th>
                <th style="width: 40px;">Min</th>
                ${session.intervals.map((inv) => `<th>${inv.label}</th>`).join('')}
                <th style="width: 45px;">Đạt (≥5)</th>
                <th style="width: 45px;">% Đạt</th>
                <th style="width: 45px;">Giỏi (≥8)</th>
                <th style="width: 45px;">% Giỏi</th>
              </tr>
            </thead>
            <tbody>
              ${session.subjects
                .map((sub) => {
                  const st = classSummary?.subjectStats[sub];
                  if (!st) return '';
                  return `
                  <tr>
                    <td class="bold-cell">${sub}</td>
                    <td>${st.count}</td>
                    <td class="highlight-cell">${st.avgScore.toFixed(2)}</td>
                    <td class="high-score">${st.maxScore.toFixed(1)}</td>
                    <td>${st.minScore.toFixed(1)}</td>
                    ${session.intervals
                      .map(
                        (inv) => `
                      <td>
                        <strong>${st.intervalCounts[inv.id] || 0}</strong>
                        <span class="pct-span">${st.intervalPercents[inv.id] || 0}%</span>
                      </td>
                    `
                      )
                      .join('')}
                    <td class="bold-cell">${st.above5Count}</td>
                    <td>${st.above5Percent}%</td>
                    <td class="bold-cell">${st.above8Count}</td>
                    <td>${st.above8Percent}%</td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
          `
              : ''
          }

          <!-- II. Danh sách học sinh -->
          <div class="section-title" style="margin-top: 14px;">II. DANH SÁCH CHI TIẾT HỌC SINH LỚP ${cName} (CÓ XẾP THỨ LỚP & TRƯỜNG)</div>
          <table class="report-table student-table ${repeatHeaderOnEveryPage ? 'repeat-header' : ''}">
            <thead>
              <tr>
                <th style="width: 32px;">STT</th>
                <th style="width: 60px;">SBD</th>
                <th style="min-width: 140px; text-align: left; padding-left: 6px;">Họ và Tên</th>
                <th style="width: 65px;">Ngày sinh</th>
                ${classStudents.some((s) => s.examRoom) ? '<th style="width: 45px;">Phòng thi</th>' : ''}
                <th style="width: 30px;">GT</th>
                ${session.subjects.map((sub) => `<th>${sub}</th>`).join('')}
                <th style="width: 60px;">Tổng điểm</th>
                <th style="width: 50px;">Điểm TB</th>
                <th style="width: 55px;">Thứ Lớp</th>
                <th style="width: 60px;">Thứ Trường</th>
              </tr>
            </thead>
            <tbody>
              ${classStudents
                .map(
                  (st, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="bold-cell">${st.sbd}</td>
                  <td style="text-align: left; padding-left: 6px; font-weight: bold;">${st.name}</td>
                  <td>${st.dob || '-'}</td>
                  ${classStudents.some((s) => s.examRoom) ? `<td>${st.examRoom || '-'}</td>` : ''}
                  <td>${st.gender || '-'}</td>
                  ${session.subjects
                    .map((sub) => {
                      const sc = st.scores[sub];
                      const isNull = sc === null || sc === undefined;
                      const isLow = typeof sc === 'number' && sc < 5.0;
                      const isHigh = typeof sc === 'number' && sc >= 8.0;
                      return `
                      <td class="${isLow ? 'low-score' : isHigh ? 'high-score' : ''}">
                        ${isNull ? '-' : sc.toFixed(1)}
                      </td>
                    `;
                    })
                    .join('')}
                  <td class="total-cell">${st.totalScore.toFixed(2)}</td>
                  <td>${st.averageScore.toFixed(2)}</td>
                  <td class="class-rank-cell">#${st.classRank}</td>
                  <td class="school-rank-cell">#${st.schoolRank}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          ${
            showSignatures
              ? `
          <!-- Chữ ký -->
          <div class="signature-block">
            <div class="date-row">Ngày ..... tháng ..... năm 20....</div>
            <div class="signature-grid">
              <div class="sig-col">
                <div class="sig-title">GIÁO VIÊN BỘ MÔN</div>
                <div class="sig-note">(Ký và ghi rõ họ tên)</div>
                <div class="sig-space"></div>
              </div>
              <div class="sig-col">
                <div class="sig-title">GIÁO VIÊN CHỦ NHIỆM</div>
                <div class="sig-note">(Ký và ghi rõ họ tên)</div>
                <div class="sig-space">${classSummary?.homeroomTeacher || ''}</div>
              </div>
              <div class="sig-col">
                <div class="sig-title">BAN GIÁM HIỆU</div>
                <div class="sig-note">(Ký, đóng dấu)</div>
                <div class="sig-space"></div>
              </div>
            </div>
          </div>
          `
              : ''
          }
        </div>
      `;
    });

    const pageSizeCss = paperSize === 'a3' ? 'A3' : paperSize === 'letter' ? 'letter' : 'A4';

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>In Báo Cáo Điểm - ${session.name}</title>
        <style>
          @page {
            size: ${pageSizeCss} ${orientation};
            margin: 8mm 6mm 8mm 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Times New Roman', Times, serif, Arial, sans-serif;
            font-size: 10pt;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
            zoom: ${scalePercent}%;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .class-report-page {
            padding: 0;
            margin: 0 auto;
            max-width: 100%;
          }
          .header-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid #333;
            padding-bottom: 4px;
            margin-bottom: 8px;
          }
          .header-left {
            text-align: center;
            width: 42%;
          }
          .header-right {
            text-align: center;
            width: 50%;
          }
          .sub-title {
            font-size: 9pt;
            font-weight: normal;
          }
          .school-title {
            font-size: 11pt;
            font-weight: bold;
            margin-top: 1px;
          }
          .doc-sub {
            font-size: 8pt;
            color: #444;
            font-style: italic;
          }
          .motto-title {
            font-size: 10pt;
            font-weight: bold;
          }
          .motto-sub {
            font-size: 9pt;
            font-weight: normal;
          }
          .motto-line {
            width: 90px;
            height: 1px;
            background: #000;
            margin: 3px auto 0 auto;
          }
          .main-title-block {
            text-align: center;
            margin: 8px 0;
          }
          .main-title {
            font-size: 13pt;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
            color: #111;
          }
          .meta-title {
            font-size: 9.5pt;
            margin-top: 2px;
          }
          .class-meta-box {
            display: flex;
            justify-content: space-between;
            background-color: #f5f5f5 !important;
            border: 1px solid #ccc;
            padding: 4px 8px;
            font-size: 9pt;
            margin-bottom: 8px;
          }
          .section-title {
            font-size: 9.5pt;
            font-weight: bold;
            margin: 6px 0 3px 0;
            text-transform: uppercase;
          }
          table.report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            text-align: center;
            margin-bottom: 6px;
          }
          table.report-table th, table.report-table td {
            border: 1px solid #444;
            padding: 3px 2px;
          }
          table.report-table th {
            background-color: #ebebeb !important;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 8pt;
          }
          table.repeat-header thead {
            display: table-header-group !important;
          }
          table.repeat-header tr {
            page-break-inside: avoid;
          }
          .bold-cell {
            font-weight: bold;
          }
          .highlight-cell {
            background-color: #f0f4ff !important;
            font-weight: bold;
          }
          .total-cell {
            background-color: #eef2ff !important;
            font-weight: bold;
            color: #1e3a8a;
          }
          .class-rank-cell {
            background-color: #ecfdf5 !important;
            font-weight: bold;
            color: #065f46;
          }
          .school-rank-cell {
            background-color: #fffbeb !important;
            font-weight: bold;
            color: #92400e;
          }
          .high-score {
            font-weight: bold;
            color: #047857;
          }
          .low-score {
            font-weight: bold;
            color: #b91c1c;
          }
          .pct-span {
            display: block;
            font-size: 7pt;
            color: #555;
          }
          .signature-block {
            margin-top: 10px;
            page-break-inside: avoid;
          }
          .date-row {
            text-align: right;
            padding-right: 40px;
            font-style: italic;
            font-size: 9pt;
            margin-bottom: 6px;
          }
          .signature-grid {
            display: flex;
            justify-content: space-around;
            text-align: center;
          }
          .sig-col {
            width: 30%;
          }
          .sig-title {
            font-weight: bold;
            font-size: 9pt;
          }
          .sig-note {
            font-size: 7.5pt;
            font-style: italic;
            color: #555;
          }
          .sig-space {
            height: 48px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            font-weight: bold;
            font-size: 9pt;
          }
        </style>
      </head>
      <body>
        ${classesHTML}
      </body>
      </html>
    `;
  };

  const handleExecutePrint = () => {
    setIsPrinting(true);

    try {
      const htmlContent = generatePrintableHTML();
      printHTML(htmlContent, {
        orientation,
        paperSize,
        title: `In_Bao_Cao_${session.name}`,
        onAfterPrint: () => {
          setIsPrinting(false);
          onClose();
        },
      });
    } catch (e) {
      console.error('Print failure', e);
      setIsPrinting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Thiết Lập In Báo Cáo Điểm & Thống Kê
              </h3>
              <p className="text-xs text-slate-500">
                Tùy chỉnh thông số in ấn: Khổ giấy, hướng in, lặp lại tiêu đề và phạm vi in
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* 0. Máy in đích (Tự động cập nhật máy in mặc định của hệ thống) */}
          <div className="bg-gradient-to-r from-emerald-50 to-indigo-50/40 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 text-slate-800">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Printer className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wide text-slate-900">
                  Đích in:
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Máy in Mặc Định Hệ Thống (Canon, HP, Brother, Epson...)
                </span>
              </div>
              <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                Hệ thống phần mềm <strong>tự động nhận diện và gửi lệnh in đến Máy in mặc định</strong> đã được cài đặt trên máy tính của bạn khi bấm nút In. Ngoài ra, trong hộp thoại in của hệ điều hành, bạn có thể chuyển đổi nhanh sang máy in khác hoặc chọn <strong>"Lưu dưới dạng PDF"</strong>.
              </p>
            </div>
          </div>

          {/* 1. Phạm vi in */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 uppercase tracking-wider block">
              1. Phạm vi in ấn
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPrintScope('current')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  printScope === 'current'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-bold text-sm">Chỉ in Lớp {selectedClass}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  In phiếu điểm & thống kê của lớp đang chọn trên màn hình
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrintScope('all')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  printScope === 'all'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="font-bold text-sm">In Tất Cả Các Lớp ({session.classes.length} Lớp)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Tự động ngắt trang: Mỗi lớp in trên 1 trang riêng biệt
                </div>
              </button>
            </div>
          </div>

          {/* 2. Khổ giấy & Hướng in */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Khổ giấy */}
            <div className="space-y-2">
              <label className="font-bold text-slate-700 uppercase tracking-wider block">
                2. Khổ giấy (Paper Size)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['a4', 'a3', 'letter'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPaperSize(sz)}
                    className={`py-2 px-3 rounded-xl font-bold uppercase text-xs border text-center transition-all ${
                      paperSize === sz
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Hướng in */}
            <div className="space-y-2">
              <label className="font-bold text-slate-700 uppercase tracking-wider block">
                3. Hướng in (Orientation)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    orientation === 'landscape'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  Khổ Ngang (Khuyên dùng)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${
                    orientation === 'portrait'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  Khổ Dọc
                </button>
              </div>
            </div>
          </div>

          {/* 3. Tỷ lệ thu phóng & Số bản in */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 uppercase tracking-wider">
                  4. Tỷ lệ thu phóng (Scale)
                </label>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {scalePercent}%
                </span>
              </div>
              <input
                type="range"
                min="65"
                max="100"
                step="5"
                value={scalePercent}
                onChange={(e) => setScalePercent(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>65% (Thu nhỏ)</span>
                <span>85% (Vừa vặn A4 chuẩn)</span>
                <span>100% (Gốc)</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700 uppercase tracking-wider block">
                5. Số lượng bản in (Copies)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 px-3 py-2 border border-slate-200 rounded-xl font-bold text-sm text-center focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-500 text-xs">
                  bản in / lần (Có thể chỉnh thêm trong hộp thoại máy in)
                </span>
              </div>
            </div>
          </div>

          {/* 4. Tùy chọn lặp lại tiêu đề và bảng */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <label className="font-bold text-slate-800 text-xs block mb-1">
              Tùy chọn nâng cao trang in:
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={repeatHeaderOnEveryPage}
                onChange={(e) => setRepeatHeaderOnEveryPage(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <strong>Tự động lặp lại dòng tiêu đề các cột</strong> khi danh sách học sinh dài sang trang thứ 2, 3...
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={showSummaryTable}
                onChange={(e) => setShowSummaryTable(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Bao gồm <strong>Bảng I. Thống kê kết quả tiêu chuẩn</strong> của lớp trên đầu trang
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Bao gồm <strong>Khung ký tên</strong> (GV Bộ môn, GV Chủ nhiệm, Ban Giám hiệu) ở cuối báo cáo
              </span>
            </label>
          </div>

          {/* Printer Instruction Notice */}
          <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 text-blue-900 text-xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Lưu ý khi xuất hiện hộp thoại máy in hệ thống:</p>
              <p className="mt-0.5 text-blue-800">
                Khi bấm <strong>"Thực hiện in ngay"</strong>, hộp thoại máy in của hệ thống Windows/Mac sẽ hiển thị. Tại đây bạn có thể chọn đích đến là <strong>Máy in thật (Canon, HP, Epson...)</strong> hoặc chọn <strong>"Lưu dưới dạng PDF"</strong> để lưu trữ file PDF điện tử chất lượng cao.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleExecutePrint}
            disabled={isPrinting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-sm shadow-indigo-300 transition-all active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Đang chuẩn bị lệnh in...' : 'Thực hiện in ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
