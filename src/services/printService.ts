/**
 * Service xử lý in ấn đa nền tảng (Universal Print Service)
 * Đảm bảo kích hoạt hộp thoại in ấn chuẩn của trình duyệt (Browser Native Print Dialog)
 * Cho phép người dùng:
 * 1. Chọn Máy in (Máy in mặc định hoặc bất kỳ máy in nào đã cài đặt)
 * 2. Chọn Khổ giấy (A4, A3, Letter...)
 * 3. Chọn Số bản in (Copies)
 * 4. Xem trước bản in thực tế (Native Print Preview)
 * 5. Chọn Hướng in (Ngang / Dọc)
 */

import { StatisticSession, ExportPrintConfig } from '../types';

export interface PrintOptions {
  orientation?: 'landscape' | 'portrait';
  paperSize?: string;
  title?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

/**
 * Thực hiện in mã HTML ra máy in thông qua iframe toàn diện và fallback an toàn
 */
export function printHTML(fullHTML: string, options: PrintOptions = {}): void {
  options.onBeforePrint?.();

  // 1. Đảm bảo container #app-print-root tồn tại trên body để hỗ trợ in trực tiếp / fallback
  let printRoot = document.getElementById('app-print-root');
  if (!printRoot) {
    printRoot = document.createElement('div');
    printRoot.id = 'app-print-root';
    document.body.appendChild(printRoot);
  }

  // 2. Tạo hoặc tái sử dụng iframe in ấn với kích thước hiển thị hợp lệ cho Chromium
  // Lưu ý quan trọng: Chromium sẽ chặn lệnh print() nếu iframe có visibility: hidden, display: none hoặc 0x0 size!
  // Vì vậy iframe PHẢI có kích thước thực (100vw x 100vh) và opacity rất nhỏ (0.001), z-index âm.
  const iframeId = 'app-universal-print-frame';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.opacity = '0.001';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);
  }

  let hasExecuted = false;

  // Fallback in ấn trực tiếp trên trang chính nếu trình duyệt chặn sandbox của iframe
  const executeInPageFallback = () => {
    if (hasExecuted) return;
    hasExecuted = true;

    try {
      if (printRoot) {
        printRoot.innerHTML = fullHTML;
        document.body.classList.add('app-printing-active');
        window.focus();
        window.print();
      }
    } catch (err) {
      console.error('Fallback in-page print failed:', err);
    } finally {
      setTimeout(() => {
        document.body.classList.remove('app-printing-active');
        if (printRoot) printRoot.innerHTML = '';
        options.onAfterPrint?.();
      }, 1000);
    }
  };

  try {
    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc || !iframe.contentWindow) {
      executeInPageFallback();
      return;
    }

    frameDoc.open();
    frameDoc.write(fullHTML);
    frameDoc.close();

    const triggerIframePrint = () => {
      if (hasExecuted) return;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        hasExecuted = true;
        setTimeout(() => {
          options.onAfterPrint?.();
        }, 800);
      } catch (err) {
        console.warn('Iframe print error, switching to in-page fallback:', err);
        executeInPageFallback();
      }
    };

    // Bắt sự kiện sau khi in xong
    try {
      iframe.contentWindow.onafterprint = () => {
        options.onAfterPrint?.();
      };
    } catch (_) {}

    // Đảm bảo iframe nạp xong nội dung, style và font chữ trước khi gọi print()
    if (frameDoc.readyState === 'complete') {
      setTimeout(triggerIframePrint, 250);
    } else {
      iframe.onload = () => setTimeout(triggerIframePrint, 200);
      setTimeout(triggerIframePrint, 500); // Hẹn giờ an toàn tối đa 500ms
    }
  } catch (err) {
    console.warn('Lỗi khởi tạo iframe in ấn, dùng in-page fallback:', err);
    executeInPageFallback();
  }
}

/**
 * Sinh mã HTML hoàn chỉnh cho báo cáo điểm thi/thống kê chuẩn trang in A4/A3
 * Bao gồm: Quốc hiệu, Tiêu ngữ, Cơ quan ban hành, Bảng I (Thống kê theo tiêu chuẩn),
 * Bảng II (Danh sách học sinh chi tiết kèm thứ bậc) và Phần chân trang chữ ký chuẩn
 */
export function generateReportPrintHTML(
  session: StatisticSession,
  targetClasses: string[],
  config: ExportPrintConfig
): string {
  const isLandscape = config.orientation === 'landscape';
  const pageSize = config.paperSize.toUpperCase();
  const hasRooms = session.students.some((s) => !!s.examRoom);

  // Danh sách các cột học sinh được hiển thị
  const activeStudentColumns: Array<{ key: string; label: string; align: 'left' | 'center' | 'right' }> = [];
  if (config.columns.stt) activeStudentColumns.push({ key: 'stt', label: 'STT', align: 'center' });
  if (config.columns.sbd) activeStudentColumns.push({ key: 'sbd', label: 'Số báo danh', align: 'center' });
  if (config.columns.name) activeStudentColumns.push({ key: 'name', label: 'Họ và tên', align: 'left' });
  if (config.columns.dob) activeStudentColumns.push({ key: 'dob', label: 'Ngày sinh', align: 'center' });
  if (config.columns.examRoom && hasRooms) activeStudentColumns.push({ key: 'examRoom', label: 'Phòng thi', align: 'center' });
  if (config.columns.gender) activeStudentColumns.push({ key: 'gender', label: 'Giới tính', align: 'center' });
  if (config.columns.className || targetClasses.length > 1) activeStudentColumns.push({ key: 'className', label: 'Lớp', align: 'center' });
  if (config.columns.grade) activeStudentColumns.push({ key: 'grade', label: 'Khối', align: 'center' });

  session.subjects.forEach((sub) => {
    if (config.columns.subjects[sub] !== false) {
      activeStudentColumns.push({ key: `sub_${sub}`, label: sub, align: 'center' });
    }
  });

  if (config.columns.totalScore) activeStudentColumns.push({ key: 'totalScore', label: 'Tổng điểm', align: 'right' });
  if (config.columns.averageScore) activeStudentColumns.push({ key: 'averageScore', label: 'Điểm TB', align: 'right' });
  if (config.columns.classRank) activeStudentColumns.push({ key: 'classRank', label: 'Thứ Lớp', align: 'center' });
  if (config.columns.schoolRank) activeStudentColumns.push({ key: 'schoolRank', label: 'Thứ Trường', align: 'center' });
  if (config.columns.notes) activeStudentColumns.push({ key: 'notes', label: 'Ghi chú', align: 'left' });

  // Tiêu chí thống kê ở bảng I
  const activeCriteriaList: Array<{ id: string; label: string }> = [];
  if (config.summaryCriteria.count) activeCriteriaList.push({ id: 'count', label: 'Số bài' });
  if (config.summaryCriteria.avgScore) activeCriteriaList.push({ id: 'avgScore', label: 'Điểm TB' });
  if (config.summaryCriteria.maxScore) activeCriteriaList.push({ id: 'maxScore', label: 'Max' });
  if (config.summaryCriteria.minScore) activeCriteriaList.push({ id: 'minScore', label: 'Min' });

  session.intervals.forEach((inv) => {
    if (config.summaryCriteria.intervals[inv.id] !== false) {
      activeCriteriaList.push({ id: `inv_${inv.id}`, label: inv.label });
    }
  });

  if (config.summaryCriteria.above5) {
    activeCriteriaList.push({ id: 'above5Count', label: 'Đạt (≥5)' });
    activeCriteriaList.push({ id: 'above5Percent', label: '% Đạt' });
  }
  if (config.summaryCriteria.above8) {
    activeCriteriaList.push({ id: 'above8Count', label: 'Giỏi (≥8)' });
    activeCriteriaList.push({ id: 'above8Percent', label: '% Giỏi' });
  }

  const custom = config.customInfo || {
    departmentName: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO',
    schoolName: session.schoolName || 'TRƯỜNG THCS THƯ VŨ',
    documentSubTitle: 'Đơn vị lưu trữ hồ sơ khảo sát',
    mottoTitle: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    mottoSubTitle: 'Độc lập - Tự do - Hạnh phúc',
    signDate: 'Ngày ..... tháng ..... năm 20....',
    subjectTeacherTitle: 'GIÁO VIÊN BỘ MÔN',
    subjectTeacherName: '',
    subjectTeacherSignatureImage: undefined,
    homeroomTeacherTitle: 'GIÁO VIÊN CHỦ NHIỆM',
    homeroomTeacherName: '',
    homeroomTeacherSignatureImage: undefined,
    headmasterTitle: 'BAN GIÁM HIỆU',
    headmasterName: '',
    headmasterSignatureImage: undefined,
  };

  const cleanSchool = (custom.schoolName || session.schoolName).trim().toUpperCase();
  const schoolDisplayText = cleanSchool.startsWith('TRƯỜNG:') ? cleanSchool : `TRƯỜNG: ${cleanSchool}`;

  let classesHTML = '';

  // 1. Khi xuất nhiều lớp: Trang đầu tiên là "Tất cả các lớp"
  if (targetClasses.length > 1) {
    const allTargetStudents = session.students
      .filter((s) => targetClasses.includes(s.className))
      .sort((a, b) => a.schoolRank - b.schoolRank);

    const totalAvgScore = allTargetStudents.length > 0
      ? (allTargetStudents.reduce((acc, s) => acc + s.averageScore, 0) / allTargetStudents.length).toFixed(2)
      : '0';

    classesHTML += `
      <div class="print-page page-break">
        <div class="header-grid">
          <div class="header-left">
            <div class="sub-title">${custom.departmentName || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}</div>
            <div class="school-title">${schoolDisplayText}</div>
            <div class="doc-sub">${custom.documentSubTitle || 'Đơn vị lưu trữ hồ sơ khảo sát'}</div>
          </div>
          <div class="header-right">
            <div class="motto-title">${custom.mottoTitle || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}</div>
            <div class="motto-sub">${custom.mottoSubTitle || 'Độc lập - Tự do - Hạnh phúc'}</div>
            <div class="motto-line"></div>
          </div>
        </div>

        <div class="main-title-block">
          <h1 class="main-title">BẢNG KẾT QUẢ ĐIỂM TỔNG HỢP - TẤT CẢ CÁC LỚP</h1>
          <div class="meta-title">Kỳ thi: <strong>${session.name}</strong> | Năm học: <strong>${session.academicYear}</strong></div>
        </div>

        <div class="class-meta-box">
          <div>Quy mô: <strong>Toàn bộ học sinh (${targetClasses.length} lớp)</strong></div>
          <div>Sĩ số: <strong>${allTargetStudents.length}</strong> học sinh | Điểm TB chung: <strong>${totalAvgScore}</strong></div>
        </div>

        ${
          config.showSummaryTable && activeCriteriaList.length > 0
            ? `
        <div class="section-title">I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN (TOÀN TRƯỜNG)</div>
        <table class="report-table summary-table">
          <thead>
            <tr>
              <th style="width: 100px;">Môn học</th>
              ${activeCriteriaList.map((crit) => `<th>${crit.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${session.subjects
              .filter((sub) => config.columns.subjects[sub] !== false)
              .map((sub) => {
                const st = session.overallStats[sub];
                if (!st) return '';
                return `
                <tr>
                  <td class="bold-cell" style="text-align: left; padding-left: 6px;">${sub}</td>
                  ${config.summaryCriteria.count ? `<td>${st.count}</td>` : ''}
                  ${config.summaryCriteria.avgScore ? `<td class="highlight-cell">${st.avgScore.toFixed(2)}</td>` : ''}
                  ${config.summaryCriteria.maxScore ? `<td class="high-score">${st.maxScore.toFixed(1)}</td>` : ''}
                  ${config.summaryCriteria.minScore ? `<td>${st.minScore.toFixed(1)}</td>` : ''}
                  ${session.intervals
                    .filter((inv) => config.summaryCriteria.intervals[inv.id] !== false)
                    .map(
                      (inv) => `
                    <td>
                      <strong>${st.intervalCounts[inv.id] || 0}</strong>
                      <span class="pct-span">${st.intervalPercents[inv.id] || 0}%</span>
                    </td>
                  `
                    )
                    .join('')}
                  ${config.summaryCriteria.above5 ? `<td class="bold-cell">${st.above5Count}</td><td>${st.above5Percent}%</td>` : ''}
                  ${config.summaryCriteria.above8 ? `<td class="bold-cell">${st.above8Count}</td><td>${st.above8Percent}%</td>` : ''}
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
        `
            : ''
        }

        <div class="section-title" style="margin-top: 12px;">
          ${config.showSummaryTable ? 'II.' : ''} DANH SÁCH CHI TIẾT HỌC SINH TẤT CẢ CÁC LỚP (CÓ XẾP THỨ TRƯỜNG & LỚP)
        </div>

        <table class="report-table student-table ${config.repeatHeaderOnEveryPage ? 'repeat-header' : ''}">
          <thead>
            <tr>
              ${activeStudentColumns.map((col) => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${allTargetStudents
              .map(
                (st, idx) => `
              <tr>
                ${activeStudentColumns
                  .map((col) => {
                    if (col.key === 'stt') return `<td>${idx + 1}</td>`;
                    if (col.key === 'sbd') return `<td class="bold-cell">${st.sbd}</td>`;
                    if (col.key === 'name') return `<td style="text-align: left; padding-left: 6px; font-weight: bold;">${st.name}</td>`;
                    if (col.key === 'dob') return `<td>${st.dob || '-'}</td>`;
                    if (col.key === 'examRoom') return `<td class="bold-cell">${st.examRoom || '-'}</td>`;
                    if (col.key === 'gender') return `<td>${st.gender || '-'}</td>`;
                    if (col.key === 'className') return `<td>${st.className}</td>`;
                    if (col.key === 'grade') return `<td>${st.grade || '-'}</td>`;
                    if (col.key.startsWith('sub_')) {
                      const subName = col.key.replace('sub_', '');
                      const sc = st.scores[subName];
                      const isNull = sc === null || sc === undefined;
                      const isLow = typeof sc === 'number' && sc < 5.0;
                      const isHigh = typeof sc === 'number' && sc >= 8.0;
                      return `<td class="${isLow ? 'low-score' : isHigh ? 'high-score' : ''}">${isNull ? '-' : sc.toFixed(1)}</td>`;
                    }
                    if (col.key === 'totalScore') return `<td class="total-cell" style="text-align: right; padding-right: 6px;">${st.totalScore.toFixed(2)}</td>`;
                    if (col.key === 'averageScore') return `<td style="text-align: right; padding-right: 6px;">${st.averageScore.toFixed(2)}</td>`;
                    if (col.key === 'classRank') return `<td class="class-rank-cell">#${st.classRank}</td>`;
                    if (col.key === 'schoolRank') return `<td class="school-rank-cell">#${st.schoolRank}</td>`;
                    if (col.key === 'notes') return `<td>${st.notes || ''}</td>`;
                    return '<td></td>';
                  })
                  .join('')}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        ${
          config.showSignatures
            ? `
        <div class="signature-block">
          <div class="signature-grid">
            <div class="sig-col">
              <div class="sig-date-spacer"></div>
              <div class="sig-title">${custom.subjectTeacherTitle || 'GIÁO VIÊN BỘ MÔN'}</div>
              <div class="sig-note">(Ký và ghi rõ họ tên)</div>
              <div class="sig-space-wrap">
                ${custom.subjectTeacherSignatureImage ? `<div class="sig-img-box"><img src="${custom.subjectTeacherSignatureImage}" class="sig-img" alt="Chữ ký GVBM" /></div>` : '<div class="sig-empty-spacer"></div>'}
                <div class="sig-name">${custom.subjectTeacherName || ''}</div>
              </div>
            </div>
            <div class="sig-col">
              <div class="sig-date-spacer"></div>
              <div class="sig-title">TỔ TRƯỞNG CHUYÊN MÔN</div>
              <div class="sig-note">(Ký và ghi rõ họ tên)</div>
              <div class="sig-space-wrap">
                ${custom.homeroomTeacherSignatureImage ? `<div class="sig-img-box"><img src="${custom.homeroomTeacherSignatureImage}" class="sig-img" alt="Chữ ký" /></div>` : '<div class="sig-empty-spacer"></div>'}
                <div class="sig-name">${custom.homeroomTeacherName || ''}</div>
              </div>
            </div>
            <div class="sig-col">
              <div class="sig-date-row">${custom.signDate || 'Ngày ..... tháng ..... năm 20....'}</div>
              <div class="sig-title">${custom.headmasterTitle || 'BAN GIÁM HIỆU'}</div>
              <div class="sig-note">(Ký, đóng dấu)</div>
              <div class="sig-space-wrap">
                ${custom.headmasterSignatureImage ? `<div class="sig-img-box"><img src="${custom.headmasterSignatureImage}" class="sig-img" alt="Dấu / Chữ ký BGH" /></div>` : '<div class="sig-empty-spacer"></div>'}
                <div class="sig-name">${custom.headmasterName || ''}</div>
              </div>
            </div>
          </div>
        </div>
        `
            : ''
        }
      </div>
    `;
  }

  // 2. Xuất từng lớp riêng biệt
  targetClasses.forEach((cName, cIdx) => {
    const cSummary = session.classSummaries[cName];
    const cStudents = session.students
      .filter((s) => s.className === cName)
      .sort((a, b) => a.classRank - b.classRank);

    const isLast = cIdx === targetClasses.length - 1;

    classesHTML += `
      <div class="print-page ${!isLast ? 'page-break' : ''}">
        <div class="header-grid">
          <div class="header-left">
            <div class="sub-title">${custom.departmentName || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO'}</div>
            <div class="school-title">${schoolDisplayText}</div>
            <div class="doc-sub">${custom.documentSubTitle || 'Đơn vị lưu trữ hồ sơ khảo sát'}</div>
          </div>
          <div class="header-right">
            <div class="motto-title">${custom.mottoTitle || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}</div>
            <div class="motto-sub">${custom.mottoSubTitle || 'Độc lập - Tự do - Hạnh phúc'}</div>
            <div class="motto-line"></div>
          </div>
        </div>

        <div class="main-title-block">
          <h1 class="main-title">BẢNG KẾT QUẢ ĐIỂM & THỐNG KÊ CHI TIẾT - LỚP ${cName.toUpperCase()}</h1>
          <div class="meta-title">Kỳ thi: <strong>${session.name}</strong> | Năm học: <strong>${session.academicYear}</strong></div>
        </div>

        <div class="class-meta-box">
          <div>Giáo viên chủ nhiệm: <strong>${cSummary?.homeroomTeacher && !cSummary.homeroomTeacher.includes('Chủ Nhiệm') ? cSummary.homeroomTeacher : '...............................'}</strong></div>
          <div>Sĩ số: <strong>${cStudents.length}</strong> học sinh | Khối: <strong>${cSummary?.grade || ''}</strong> | Điểm TB lớp: <strong>${cSummary?.avgTotalScore || 0}</strong></div>
        </div>

        ${
          config.showSummaryTable && activeCriteriaList.length > 0
            ? `
        <div class="section-title">I. BẢNG THỐNG KÊ KẾT QUẢ THEO TIÊU CHUẨN CỦA LỚP</div>
        <table class="report-table summary-table">
          <thead>
            <tr>
              <th style="width: 100px;">Môn học</th>
              ${activeCriteriaList.map((crit) => `<th>${crit.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${session.subjects
              .filter((sub) => config.columns.subjects[sub] !== false)
              .map((sub) => {
                const st = cSummary?.subjectStats[sub];
                if (!st) return '';
                return `
                <tr>
                  <td class="bold-cell" style="text-align: left; padding-left: 6px;">${sub}</td>
                  ${config.summaryCriteria.count ? `<td>${st.count}</td>` : ''}
                  ${config.summaryCriteria.avgScore ? `<td class="highlight-cell">${st.avgScore.toFixed(2)}</td>` : ''}
                  ${config.summaryCriteria.maxScore ? `<td class="high-score">${st.maxScore.toFixed(1)}</td>` : ''}
                  ${config.summaryCriteria.minScore ? `<td>${st.minScore.toFixed(1)}</td>` : ''}
                  ${session.intervals
                    .filter((inv) => config.summaryCriteria.intervals[inv.id] !== false)
                    .map(
                      (inv) => `
                    <td>
                      <strong>${st.intervalCounts[inv.id] || 0}</strong>
                      <span class="pct-span">${st.intervalPercents[inv.id] || 0}%</span>
                    </td>
                  `
                    )
                    .join('')}
                  ${config.summaryCriteria.above5 ? `<td class="bold-cell">${st.above5Count}</td><td>${st.above5Percent}%</td>` : ''}
                  ${config.summaryCriteria.above8 ? `<td class="bold-cell">${st.above8Count}</td><td>${st.above8Percent}%</td>` : ''}
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
        `
            : ''
        }

        <div class="section-title" style="margin-top: 12px;">
          ${config.showSummaryTable ? 'II.' : ''} DANH SÁCH CHI TIẾT HỌC SINH LỚP ${cName} (CÓ XẾP THỨ LỚP & TRƯỜNG)
        </div>

        <table class="report-table student-table ${config.repeatHeaderOnEveryPage ? 'repeat-header' : ''}">
          <thead>
            <tr>
              ${activeStudentColumns.map((col) => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${cStudents
              .map(
                (st, idx) => `
              <tr>
                ${activeStudentColumns
                  .map((col) => {
                    if (col.key === 'stt') return `<td>${idx + 1}</td>`;
                    if (col.key === 'sbd') return `<td class="bold-cell">${st.sbd}</td>`;
                    if (col.key === 'name') return `<td style="text-align: left; padding-left: 6px; font-weight: bold;">${st.name}</td>`;
                    if (col.key === 'dob') return `<td>${st.dob || '-'}</td>`;
                    if (col.key === 'examRoom') return `<td class="bold-cell">${st.examRoom || '-'}</td>`;
                    if (col.key === 'gender') return `<td>${st.gender || '-'}</td>`;
                    if (col.key === 'className') return `<td>${st.className}</td>`;
                    if (col.key === 'grade') return `<td>${st.grade || '-'}</td>`;
                    if (col.key.startsWith('sub_')) {
                      const subName = col.key.replace('sub_', '');
                      const sc = st.scores[subName];
                      const isNull = sc === null || sc === undefined;
                      const isLow = typeof sc === 'number' && sc < 5.0;
                      const isHigh = typeof sc === 'number' && sc >= 8.0;
                      return `<td class="${isLow ? 'low-score' : isHigh ? 'high-score' : ''}">${isNull ? '-' : sc.toFixed(1)}</td>`;
                    }
                    if (col.key === 'totalScore') return `<td class="total-cell" style="text-align: right; padding-right: 6px;">${st.totalScore.toFixed(2)}</td>`;
                    if (col.key === 'averageScore') return `<td style="text-align: right; padding-right: 6px;">${st.averageScore.toFixed(2)}</td>`;
                    if (col.key === 'classRank') return `<td class="class-rank-cell">#${st.classRank}</td>`;
                    if (col.key === 'schoolRank') return `<td class="school-rank-cell">#${st.schoolRank}</td>`;
                    if (col.key === 'notes') return `<td>${st.notes || ''}</td>`;
                    return '<td></td>';
                  })
                  .join('')}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        ${
          config.showSignatures
            ? `
        <div class="signature-block">
          <div class="signature-grid">
            <div class="sig-col">
              <div class="sig-date-spacer"></div>
              <div class="sig-title">${custom.subjectTeacherTitle || 'GIÁO VIÊN BỘ MÔN'}</div>
              <div class="sig-note">(Ký và ghi rõ họ tên)</div>
              <div class="sig-space-wrap">
                ${custom.subjectTeacherSignatureImage ? `<div class="sig-img-box"><img src="${custom.subjectTeacherSignatureImage}" class="sig-img" alt="Chữ ký GVBM" /></div>` : '<div class="sig-empty-spacer"></div>'}
                <div class="sig-name">${custom.subjectTeacherName || ''}</div>
              </div>
            </div>
            <div class="sig-col">
              <div class="sig-date-spacer"></div>
              <div class="sig-title">${custom.homeroomTeacherTitle || 'GIÁO VIÊN CHỦ NHIỆM'}</div>
              <div class="sig-note">(Ký và ghi rõ họ tên)</div>
              <div class="sig-space-wrap">
                ${custom.homeroomTeacherSignatureImage ? `<div class="sig-img-box"><img src="${custom.homeroomTeacherSignatureImage}" class="sig-img" alt="Chữ ký GVCN" /></div>` : '<div class="sig-empty-spacer"></div>'}
                <div class="sig-name">${custom.homeroomTeacherName || (cSummary?.homeroomTeacher && !cSummary.homeroomTeacher.includes('Chủ Nhiệm') ? cSummary.homeroomTeacher : '')}</div>
              </div>
            </div>
            <div class="sig-col">
              <div class="sig-date-row">${custom.signDate || 'Ngày ..... tháng ..... năm 20....'}</div>
              <div class="sig-title">${custom.headmasterTitle || 'BAN GIÁM HIỆU'}</div>
              <div class="sig-note">(Ký, đóng dấu)</div>
              <div class="sig-space-wrap">
                ${custom.headmasterSignatureImage ? `<div class="sig-img-box"><img src="${custom.headmasterSignatureImage}" class="sig-img" alt="Dấu / Chữ ký BGH" /></div>` : '<div class="sig-empty-spacer"></div>'}
                <div class="sig-name">${custom.headmasterName || ''}</div>
              </div>
            </div>
          </div>
        </div>
        `
            : ''
        }
      </div>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <title>Báo Cáo Điểm - ${session.name}</title>
      <style>
        @page {
          size: ${pageSize} ${config.orientation};
          margin: 7mm 6mm 7mm 6mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Times New Roman', Times, serif, Arial, sans-serif;
          font-size: 9.5pt;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 0;
          zoom: ${config.scalePercent}%;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        .print-page {
          margin: 0 auto;
          max-width: 100%;
        }
        .header-grid {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1.5px solid #333;
          padding-bottom: 3px;
          margin-bottom: 6px;
        }
        .header-left { text-align: center; width: 42%; }
        .header-right { text-align: center; width: 50%; }
        .sub-title { font-size: 8.5pt; font-weight: bold; color: #1e293b; }
        .school-title { font-size: 10.5pt; font-weight: bold; margin-top: 1px; color: #000; }
        .doc-sub { font-size: 8pt; color: #555; font-style: italic; margin-top: 1px; }
        .motto-title { font-size: 9.5pt; font-weight: bold; color: #000; }
        .motto-sub { font-size: 8.5pt; font-style: italic; color: #1e293b; }
        .motto-line { width: 85px; height: 1px; background: #000; margin: 3px auto 0 auto; }
        .main-title-block { text-align: center; margin: 6px 0; }
        .main-title { font-size: 13pt; font-weight: bold; margin: 0; text-transform: uppercase; }
        .meta-title { font-size: 9pt; margin-top: 2px; }
        .class-meta-box {
          display: flex;
          justify-content: space-between;
          background-color: #f7f9fa !important;
          border: 1px solid #ccc;
          padding: 3px 8px;
          font-size: 9pt;
          margin-bottom: 6px;
        }
        .section-title { font-size: 9pt; font-weight: bold; margin: 5px 0 2px 0; text-transform: uppercase; }
        table.report-table { width: 100%; border-collapse: collapse; font-size: 8pt; text-align: center; margin-bottom: 4px; }
        table.report-table th, table.report-table td { border: 1px solid #444; padding: 2.5px 2px; }
        table.report-table th { background-color: #ededed !important; font-weight: bold; font-size: 7.5pt; text-transform: uppercase; }
        table.repeat-header thead { display: table-header-group !important; }
        table.repeat-header tr { page-break-inside: avoid; }
        .bold-cell { font-weight: bold; }
        .highlight-cell { background-color: #f0f4ff !important; font-weight: bold; }
        .total-cell { background-color: #eef2ff !important; font-weight: bold; color: #1e3a8a; }
        .class-rank-cell { background-color: #ecfdf5 !important; font-weight: bold; color: #065f46; }
        .school-rank-cell { background-color: #fffbeb !important; font-weight: bold; color: #92400e; }
        .high-score { font-weight: bold; color: #047857; }
        .low-score { font-weight: bold; color: #b91c1c; }
        .pct-span { display: block; font-size: 6.5pt; color: #555; }
        .signature-block { margin-top: 10px; page-break-inside: avoid; }
        .signature-grid { display: flex; justify-content: space-between; text-align: center; }
        .sig-col { width: 31%; text-align: center; }
        .sig-date-row { font-style: italic; font-size: 8.5pt; color: #1e293b; min-height: 18px; line-height: 18px; margin-bottom: 3px; }
        .sig-date-spacer { min-height: 18px; margin-bottom: 3px; }
        .sig-title { font-weight: bold; font-size: 9pt; text-transform: uppercase; color: #000; }
        .sig-space-wrap { min-height: 52px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; margin-top: 3px; }
        .sig-img-box { height: 38px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; }
        .sig-img { max-height: 38px; max-width: 120px; object-fit: contain; }
        .sig-empty-spacer { height: 38px; }
        .sig-name { font-weight: bold; font-size: 9pt; color: #000; min-height: 14px; }
      </style>
    </head>
    <body>${classesHTML}</body>
    </html>
  `;
}
