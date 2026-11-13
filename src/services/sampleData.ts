import { ScoreInterval, Student, StatisticSession } from '../types';

export const DEFAULT_10_INTERVALS: ScoreInterval[] = [
  { id: 'int_0_1', label: '0 đến < 1.0', min: 0, max: 1, color: '#ef4444' },
  { id: 'int_1_2', label: '1.0 đến < 2.0', min: 1, max: 2, color: '#f97316' },
  { id: 'int_2_3', label: '2.0 đến < 3.0', min: 2, max: 3, color: '#f59e0b' },
  { id: 'int_3_4', label: '3.0 đến < 4.0', min: 3, max: 4, color: '#eab308' },
  { id: 'int_4_5', label: '4.0 đến < 5.0', min: 4, max: 5, color: '#84cc16' },
  { id: 'int_5_6', label: '5.0 đến < 6.0', min: 5, max: 6, color: '#22c55e' },
  { id: 'int_6_7', label: '6.0 đến < 7.0', min: 6, max: 7, color: '#10b981' },
  { id: 'int_7_8', label: '7.0 đến < 8.0', min: 7, max: 8, color: '#06b6d4' },
  { id: 'int_8_9', label: '8.0 đến < 9.0', min: 8, max: 9, color: '#3b82f6' },
  { id: 'int_9_10', label: '9.0 đến 10.0', min: 9, max: 10, color: '#8b5cf6' },
];

export const MOET_RANKING_INTERVALS: ScoreInterval[] = [
  { id: 'moet_kem', label: 'Kém (< 3.5)', min: 0, max: 3.5, color: '#ef4444' },
  { id: 'moet_yeu', label: 'Yếu (3.5 - < 5.0)', min: 3.5, max: 5.0, color: '#f97316' },
  { id: 'moet_tb', label: 'Trung bình (5.0 - < 6.5)', min: 5.0, max: 6.5, color: '#eab308' },
  { id: 'moet_kha', label: 'Khá (6.5 - < 8.0)', min: 6.5, max: 8.0, color: '#10b981' },
  { id: 'moet_gioi', label: 'Giỏi (8.0 - < 9.0)', min: 8.0, max: 9.0, color: '#3b82f6' },
  { id: 'moet_xuatsac', label: 'Xuất sắc (9.0 - 10.0)', min: 9.0, max: 10.0, color: '#8b5cf6' },
];

export const PASS_FAIL_INTERVALS: ScoreInterval[] = [
  { id: 'pf_fail', label: 'Dưới 5.0 (Chưa đạt)', min: 0, max: 5.0, color: '#ef4444' },
  { id: 'pf_pass', label: 'Từ 5.0 đến < 8.0 (Đạt)', min: 5.0, max: 8.0, color: '#10b981' },
  { id: 'pf_high', label: 'Từ 8.0 đến 10.0 (Giỏi)', min: 8.0, max: 10.0, color: '#3b82f6' },
];

export const SAMPLE_SUBJECTS = ['Toán', 'Văn', 'Anh', 'Tin'];

export const SAMPLE_TEACHERS: Record<string, string> = {
  '9A1': 'ThS. Nguyễn Văn Hùng',
  '9A2': 'Cô Trần Thị Mai Lan',
  '9A3': 'Thầy Lê Hoàng Nam',
  '9A4': 'Cô Vũ Thị Thu Hà',
  '9A5': 'Thầy Đỗ Minh Quân',
};

// Raw student seed data
export interface RawStudentSeed {
  sbd: string;
  name: string;
  dob: string;
  gender: string;
  className: string;
  examRoom?: string;
  scores: Record<string, number>;
}

// 169 học sinh của 5 lớp (9A1: 34 HS, 9A2: 34 HS, 9A3: 34 HS, 9A4: 34 HS, 9A5: 33 HS = 169 HS)
function generate169Students(): RawStudentSeed[] {
  const classesInfo = [
    { className: '9A1', examRoom: '901', count: 34 },
    { className: '9A2', examRoom: '902', count: 34 },
    { className: '9A3', examRoom: '903', count: 34 },
    { className: '9A4', examRoom: '904', count: 34 },
    { className: '9A5', examRoom: '905', count: 33 },
  ];

  const firstNames = [
    'NGUYỄN', 'TRẦN', 'LÊ', 'PHẠM', 'HOÀNG', 'VŨ', 'VÕ', 'ĐẶNG', 'BÙI', 'ĐỖ',
    'HỒ', 'NGÔ', 'DƯƠNG', 'LÝ', 'ĐOÀN', 'MAI', 'TRỊNH', 'LƯƠNG', 'CHU', 'ĐINH',
    'PHAN', 'TẠ', 'CAO', 'VƯƠNG'
  ];

  const maleNames = [
    'HOÀNG LONG', 'HOÀNG ANH', 'MINH KHANG', 'TUẤN KIỆT', 'ĐỨC TRỌNG', 'THÀNH VINH', 'QUỐC HUY',
    'THẾ VŨ', 'QUANG DŨNG', 'HOÀI NAM', 'HỮU PHƯỚC', 'ĐÌNH TRỌNG', 'HẢI ĐĂNG', 'TUẤN ANH',
    'BẢO LÂM', 'MINH QUÂN', 'ANH DŨNG', 'GIA HUY', 'MINH ĐỨC', 'TIẾN ĐẠT', 'BẢO NAM',
    'TRỌNG HIẾU', 'NHẬT MINH', 'ĐỨC ANH', 'VĂN CƯỜNG', 'HUY HOÀNG', 'THÁI BẢO', 'QUANG KHẢI',
    'DUY HƯNG', 'HỒNG PHÚC', 'HOÀNG HẢI', 'TUẤN HƯNG', 'MINH TRIẾT', 'PHÚC HƯNG', 'HỮU NGHĨA',
    'ĐĂNG KHOA', 'QUỐC TRUNG', 'THÀNH CÔNG', 'ĐỨC THẮNG', 'VIỆT ANH'
  ];

  const femaleNames = [
    'MỸ LINH', 'KIM NGÂN', 'NGỌC HÂN', 'THÙY TRANG', 'KHÁNH AN', 'BẢO TRÂM', 'CẨM TÚ',
    'THẢO MY', 'MINH CHÂU', 'PHƯƠNG LINH', 'THANH MAI', 'DIỆU HUYỀN', 'THU TRANG', 'ÁNH TUYẾT',
    'THẢO VY', 'QUỲNH ANH', 'MAI ANH', 'THU UYÊN', 'NGỌC ÁNH', 'LAN ANH', 'BẢO NGỌC',
    'THU THẢO', 'KIỀU OANH', 'THỤC ANH', 'HÀ MY', 'PHƯƠNG THẢO', 'THÙY DƯƠNG', 'THANH THẢO',
    'KHÁNH LINH', 'TUYẾT MAI', 'THÚY NGA', 'HƯƠNG GIANG', 'HỒNG NHUNG', 'THANH HÀ', 'BÍCH NGỌC',
    'TỐ UYÊN', 'NGỌC DIỆP', 'HOÀNG YẾN', 'TRÀ MY', 'HẢI YẾN'
  ];

  // Các phổ điểm mẫu chuẩn để phân bố điểm đẹp và tự nhiên
  const scorePresets = [
    { toan: 8.25, van: 7.8, anh: 8.5, tin: 8.5 },
    { toan: 9.25, van: 8.5, anh: 9.5, tin: 9.0 },
    { toan: 8.75, van: 8.0, anh: 9.0, tin: 8.5 },
    { toan: 7.5, van: 7.0, anh: 8.0, tin: 8.0 },
    { toan: 9.0, van: 8.75, anh: 9.0, tin: 9.5 },
    { toan: 8.0, van: 7.25, anh: 8.0, tin: 8.5 },
    { toan: 8.5, van: 8.5, anh: 8.8, tin: 8.0 },
    { toan: 7.0, van: 6.5, anh: 7.0, tin: 7.5 },
    { toan: 8.25, van: 8.0, anh: 8.5, tin: 9.0 },
    { toan: 6.5, van: 6.0, anh: 6.5, tin: 7.0 },
    { toan: 9.5, van: 8.0, anh: 9.25, tin: 9.5 },
    { toan: 8.5, van: 8.25, anh: 8.8, tin: 8.5 },
    { toan: 8.0, van: 7.0, anh: 7.5, tin: 8.0 },
    { toan: 7.75, van: 8.0, anh: 8.5, tin: 8.0 },
    { toan: 7.0, van: 6.5, anh: 7.0, tin: 7.5 },
    { toan: 6.5, van: 7.5, anh: 7.0, tin: 7.5 },
    { toan: 5.5, van: 5.5, anh: 5.5, tin: 6.0 },
    { toan: 6.0, van: 7.0, anh: 6.5, tin: 7.0 },
    { toan: 4.5, van: 4.5, anh: 4.0, tin: 5.0 },
    { toan: 7.5, van: 8.0, anh: 8.25, tin: 8.0 },
    { toan: 8.5, van: 9.25, anh: 9.5, tin: 9.0 },
    { toan: 7.0, van: 8.5, anh: 8.0, tin: 8.0 },
    { toan: 7.5, van: 9.0, anh: 8.5, tin: 8.5 },
    { toan: 6.0, van: 7.5, anh: 7.0, tin: 7.5 },
    { toan: 5.5, van: 8.0, anh: 7.0, tin: 7.0 },
    { toan: 4.5, van: 6.5, anh: 5.0, tin: 5.5 },
    { toan: 6.75, van: 8.25, anh: 7.5, tin: 8.0 },
    { toan: 5.0, van: 6.0, anh: 5.5, tin: 6.0 },
    { toan: 7.25, van: 8.5, anh: 8.0, tin: 8.5 },
    { toan: 3.5, van: 5.0, anh: 4.0, tin: 5.0 },
    { toan: 9.0, van: 8.5, anh: 8.75, tin: 9.0 },
    { toan: 8.25, van: 7.5, anh: 8.0, tin: 8.5 },
    { toan: 7.75, van: 7.25, anh: 7.5, tin: 8.0 },
    { toan: 6.5, van: 6.75, anh: 7.0, tin: 7.5 },
  ];

  const students: RawStudentSeed[] = [];
  let globalIndex = 0;

  classesInfo.forEach((cInfo) => {
    for (let i = 0; i < cInfo.count; i++) {
      globalIndex++;
      const isMale = globalIndex % 2 === 1;
      const fn = firstNames[(globalIndex * 7) % firstNames.length];
      const ln = isMale
        ? maleNames[(globalIndex * 13) % maleNames.length]
        : femaleNames[(globalIndex * 11) % femaleNames.length];
      const fullName = `${fn} ${ln}`;

      const day = ((globalIndex * 3) % 28) + 1;
      const month = ((globalIndex * 5) % 12) + 1;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const dob = `${dayStr}/${monthStr}/2012`;

      const sbd = (10000000 + globalIndex).toString();
      const p = scorePresets[i % scorePresets.length];

      // Điều chỉnh điểm nhẹ theo từng lớp để có tính đa dạng
      const offset = (cInfo.className === '9A1' ? 0.25 : cInfo.className === '9A5' ? -0.25 : 0);
      const clamp = (v: number) => Math.max(2.0, Math.min(10.0, Math.round((v + offset) * 100) / 100));

      students.push({
        sbd,
        name: fullName,
        dob,
        gender: isMale ? 'Nam' : 'Nữ',
        className: cInfo.className,
        examRoom: cInfo.examRoom,
        scores: {
          'Toán': clamp(p.toan),
          'Văn': clamp(p.van),
          'Anh': clamp(p.anh),
          'Tin': clamp(p.tin),
        },
      });
    }
  });

  return students;
}

export const RAW_STUDENTS: RawStudentSeed[] = generate169Students();

/**
 * Tính toán đầy đủ thống kê, xếp thứ hạng trường và lớp cho tập dữ liệu học sinh
 */
export function processStudentData(
  rawList: Array<{
    stt?: number;
    sbd: string;
    soPhach?: string;
    name: string;
    dob?: string;
    gender?: string;
    school?: string;
    grade?: string;
    className: string;
    examRoom?: string;
    scores: Record<string, number | null>;
  }>,
  sessionName: string = 'Thống kê - Kiểm tra giữa học kỳ 1 - năm học 2026-2027',
  schoolName: string = 'Trường THCS Thư Vũ',
  academicYear: string = '2026 - 2027',
  intervals: ScoreInterval[] = DEFAULT_10_INTERVALS,
  fileName: string = 'Mau_Danh_Sach_Diem_Hoc_Sinh.xlsx',
  fileSize: number = 15564,
  existingSessionId?: string,
  existingTeachers?: Record<string, string>,
  existingCreatedAt?: number
): StatisticSession {
  // 1. Thu thập danh sách môn học
  const subjectsSet = new Set<string>();
  const classesSet = new Set<string>();
  const gradesSet = new Set<string>();

  rawList.forEach((r) => {
    if (r.className) classesSet.add(r.className.trim());
    if (r.grade) {
      gradesSet.add(r.grade.trim());
    } else if (r.className) {
      // Derive grade from class name: 9D1 -> Khối 9, 10A1 -> Khối 10
      const match = r.className.match(/^(\d+)/);
      if (match) {
        gradesSet.add(`Khối ${match[1]}`);
      } else {
        gradesSet.add('Khối chung');
      }
    }
    Object.keys(r.scores).forEach((sub) => {
      if (r.scores[sub] !== null && r.scores[sub] !== undefined) {
        subjectsSet.add(sub);
      }
    });
  });

  const subjects = Array.from(subjectsSet);
  const classes = Array.from(classesSet).sort();
  const grades = Array.from(gradesSet).sort();

  // 2. Tính Tổng điểm và Điểm trung bình cho từng học sinh
  const studentsWithTotals = rawList.map((r, idx) => {
    let sum = 0;
    let count = 0;
    subjects.forEach((sub) => {
      const score = r.scores[sub];
      if (typeof score === 'number' && !isNaN(score)) {
        sum += score;
        count++;
      }
    });

    const totalScore = Math.round(sum * 100) / 100;
    const averageScore = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
    const derivedGrade = r.grade || (r.className.match(/^(\d+)/) ? `Khối ${r.className.match(/^(\d+)/)![1]}` : 'Khối 9');

    return {
      id: `std_${idx + 1}_${r.sbd ? r.sbd.replace(/\s+/g, '_') : `hs_${idx + 1}`}`,
      stt: r.stt || idx + 1,
      sbd: r.sbd ? String(r.sbd).trim() : '',
      soPhach: r.soPhach ? String(r.soPhach).trim() : '',
      name: r.name ? String(r.name).trim() : `Học sinh ${idx + 1}`,
      dob: r.dob ? String(r.dob).trim() : '',
      gender: r.gender ? String(r.gender).trim() : '',
      school: r.school ? String(r.school).trim() : (schoolName || 'Trường THCS Thư Vũ'),
      grade: derivedGrade,
      className: r.className ? String(r.className).trim() : 'Lớp 1',
      examRoom: r.examRoom ? String(r.examRoom).trim() : '',
      scores: r.scores,
      totalScore,
      averageScore,
      schoolRank: 0,
      classRank: 0,
    } as Student;
  });

  // 3. Tính Xếp thứ theo Trường (Toàn trường)
  // Sắp xếp giảm dần theo Tổng điểm (nếu bằng thì so sánh Điểm TB)
  const schoolSorted = [...studentsWithTotals].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.averageScore - a.averageScore;
  });

  let currentRank = 1;
  for (let i = 0; i < schoolSorted.length; i++) {
    if (i > 0) {
      const prev = schoolSorted[i - 1];
      const curr = schoolSorted[i];
      if (curr.totalScore === prev.totalScore && curr.averageScore === prev.averageScore) {
        curr.schoolRank = prev.schoolRank;
      } else {
        curr.schoolRank = i + 1;
      }
    } else {
      schoolSorted[0].schoolRank = 1;
    }
  }

  // 4. Tính Xếp thứ theo Lớp
  classes.forEach((cName) => {
    const classStudents = schoolSorted.filter((s) => s.className === cName);
    classStudents.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.averageScore - a.averageScore;
    });

    for (let i = 0; i < classStudents.length; i++) {
      if (i > 0) {
        const prev = classStudents[i - 1];
        const curr = classStudents[i];
        if (curr.totalScore === prev.totalScore && curr.averageScore === prev.averageScore) {
          curr.classRank = prev.classRank;
        } else {
          curr.classRank = i + 1;
        }
      } else {
        classStudents[0].classRank = 1;
      }
    }
  });

  // Sắp xếp lại học sinh theo STT ban đầu hoặc Lớp + SBD
  const finalStudents = schoolSorted.sort((a, b) => a.stt - b.stt);

  // 5. Thống kê theo tiêu chuẩn (Toàn trường & từng Lớp)
  const calculateSubjectStats = (studentSubset: Student[], subName: string) => {
    const validScores: number[] = [];
    studentSubset.forEach((s) => {
      const sc = s.scores[subName];
      if (typeof sc === 'number' && !isNaN(sc)) {
        validScores.push(sc);
      }
    });

    const count = validScores.length;
    if (count === 0) {
      return {
        subjectName: subName,
        count: 0,
        maxScore: 0,
        minScore: 0,
        avgScore: 0,
        intervalCounts: {},
        intervalPercents: {},
        above5Count: 0,
        above5Percent: 0,
        above8Count: 0,
        above8Percent: 0,
      };
    }

    const maxScore = Math.max(...validScores);
    const minScore = Math.min(...validScores);
    const sum = validScores.reduce((acc, v) => acc + v, 0);
    const avgScore = Math.round((sum / count) * 100) / 100;

    const intervalCounts: Record<string, number> = {};
    const intervalPercents: Record<string, number> = {};

    intervals.forEach((inv) => {
      let matchCount = 0;
      validScores.forEach((score) => {
        if (inv.max === 10) {
          if (score >= inv.min && score <= 10.0) matchCount++;
        } else {
          if (score >= inv.min && score < inv.max) matchCount++;
        }
      });
      intervalCounts[inv.id] = matchCount;
      intervalPercents[inv.id] = Math.round((matchCount / count) * 1000) / 10;
    });

    const above5Count = validScores.filter((s) => s >= 5.0).length;
    const above5Percent = Math.round((above5Count / count) * 1000) / 10;
    const above8Count = validScores.filter((s) => s >= 8.0).length;
    const above8Percent = Math.round((above8Count / count) * 1000) / 10;

    return {
      subjectName: subName,
      count,
      maxScore,
      minScore,
      avgScore,
      intervalCounts,
      intervalPercents,
      above5Count,
      above5Percent,
      above8Count,
      above8Percent,
    };
  };

  // Thống kê toàn trường
  const overallStats: Record<string, any> = {};
  subjects.forEach((sub) => {
    overallStats[sub] = calculateSubjectStats(finalStudents, sub);
  });

  // Thống kê từng lớp
  const classSummaries: Record<string, any> = {};
  classes.forEach((cName) => {
    const classStudents = finalStudents.filter((s) => s.className === cName);
    const totalScoresSum = classStudents.reduce((acc, s) => acc + s.totalScore, 0);
    const avgTotalScore = classStudents.length > 0 ? Math.round((totalScoresSum / classStudents.length) * 100) / 100 : 0;
    const classGrade = classStudents[0]?.grade || 'Khối 10';

    const subStats: Record<string, any> = {};
    subjects.forEach((sub) => {
      subStats[sub] = calculateSubjectStats(classStudents, sub);
    });

    classSummaries[cName] = {
      className: cName,
      grade: classGrade,
      homeroomTeacher: existingTeachers?.[cName] || SAMPLE_TEACHERS[cName] || '',
      studentCount: classStudents.length,
      avgTotalScore,
      subjectStats: subStats,
    };
  });

  return {
    id: existingSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: sessionName,
    createdAt: existingCreatedAt || Date.now(),
    schoolName,
    academicYear,
    fileName,
    fileSize,
    subjects,
    classes,
    grades,
    intervals,
    students: finalStudents,
    classSummaries,
    overallStats,
  };
}

export function createInitialSampleSession(): StatisticSession {
  // Thời gian tạo: 12:40 07/11/2026
  const createdAt = new Date('2026-11-07T12:40:00').getTime();
  const session = processStudentData(
    RAW_STUDENTS.map((r, idx) => ({
      stt: idx + 1,
      sbd: r.sbd,
      name: r.name,
      dob: r.dob,
      gender: r.gender,
      school: 'Trường THCS Thư Vũ',
      grade: 'Khối 9',
      className: r.className,
      examRoom: r.examRoom,
      scores: r.scores,
    })),
    'Thống kê - Kiểm tra giữa học kỳ 1 - năm học 2026-2027',
    'Trường THCS Thư Vũ',
    '2026 - 2027',
    DEFAULT_10_INTERVALS,
    'Mau_Danh_Sach_Diem_Hoc_Sinh.xlsx',
    15564 // 15.2 KB
  );
  session.createdAt = createdAt;
  return session;
}
