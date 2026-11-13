import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeightRule,
  TableLayoutType,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { StatisticSession, Student } from '../types';
import { printHTML } from './printService';

export interface GradeSlipOptions {
  departmentName?: string;
  schoolName?: string;
  academicYear?: string;
  examDate?: string;
  signDate?: string;
  homeroomTeacherName?: string;
  homeroomTeacherSignatureImage?: string;
  schoolRepresentativeName?: string;
  schoolRepresentativeSignatureImage?: string;
  autoComment?: boolean;
  notesTitle?: string;
}

function getImageType(dataUri: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  if (dataUri.includes('image/jpeg') || dataUri.includes('image/jpg')) return 'jpg';
  if (dataUri.includes('image/gif')) return 'gif';
  if (dataUri.includes('image/bmp')) return 'bmp';
  return 'png';
}

const NAVY_COLOR = '1F4E79';
const BORDER_COLOR = '444444';

const THIN_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: BORDER_COLOR,
};

const NO_BORDER = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
};

const TABLE_BORDERS_ALL = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
  insideHorizontal: THIN_BORDER,
  insideVertical: THIN_BORDER,
};

const TABLE_BORDERS_NONE = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

/**
 * Tạo gợi ý nhận xét giáo viên chủ nhiệm dựa vào điểm số và học lực
 */
export function getAutoComment(st: Student): string {
  const avg = st.averageScore;
  if (avg >= 8.0) {
    return `Học sinh đạt kết quả xuất sắc (xếp thứ #${st.classRank} của lớp), nắm rất vững kiến thức các môn, chăm ngoan và có ý thức học tập rất tốt.`;
  }
  if (avg >= 6.5) {
    return `Học sinh có học lực Khá (xếp thứ #${st.classRank} của lớp), tiếp thu bài nhanh, cần tiếp tục phát huy hơn nữa ở các bài kiểm tra tiếp theo.`;
  }
  if (avg >= 5.0) {
    return `Học sinh đạt mức Trung bình (xếp thứ #${st.classRank} của lớp), cần tập trung rèn luyện thêm ở những môn còn yếu để nâng cao thành tích.`;
  }
  return `Kết quả bài kiểm tra còn hạn chế (xếp thứ #${st.classRank} của lớp), gia đình cần phối hợp chặt chẽ với giáo viên để đôn đốc việc học tập của em.`;
}

/**
 * Xây dựng nội dung cho 1 phiếu báo điểm trong Word docx
 */
function buildStudentDocxElements(
  st: Student,
  session: StatisticSession,
  options: GradeSlipOptions,
  classTotal: number,
  schoolTotal: number
): (Paragraph | Table)[] {
  const department = options.departmentName || 'UBND xã..........................';
  const school = options.schoolName || session.schoolName || 'TRƯỜNG ....................................';
  const academicYear = options.academicYear || session.academicYear || '20... – 20...';
  const examDate = options.examDate || '......../......../............';
  const signDate = options.signDate || '...................., ngày ...... tháng ...... năm 20......';
  // Bỏ trống tên GVCN theo chuẩn mẫu để thầy cô ký và ghi rõ họ tên bằng tay
  const teacherName = options.homeroomTeacherName?.trim() || '';

  const elements: (Paragraph | Table)[] = [];

  // 1. Quốc hiệu - Tiêu ngữ & Đơn vị (Bảng 1 hàng, 2 cột không viền)
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS_NONE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 48, type: WidthType.PERCENTAGE },
              borders: TABLE_BORDERS_NONE,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: department.toUpperCase(), bold: true, size: 20, font: 'Times New Roman' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: `TRƯỜNG: ${school}`.toUpperCase(), bold: true, size: 20, font: 'Times New Roman' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: '-----------------------', size: 16, font: 'Times New Roman', color: '888888' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              width: { size: 52, type: WidthType.PERCENTAGE },
              borders: TABLE_BORDERS_NONE,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 20, font: 'Times New Roman' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'Độc lập – Tự do – Hạnh phúc', bold: true, size: 20, font: 'Times New Roman' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: '---------------------------', size: 16, font: 'Times New Roman', color: '444444' })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  elements.push(new Paragraph({ text: '', spacing: { before: 80, after: 80 } }));

  // 2. Tiêu đề GIẤY BÁO ĐIỂM
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'GIẤY BÁO ĐIỂM',
          bold: true,
          size: 36, // 18pt
          color: NAVY_COLOR,
          font: 'Times New Roman',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 60 },
    })
  );

  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Năm học ${academicYear}`,
          bold: true,
          size: 22, // 11pt
          font: 'Times New Roman',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
    })
  );

  // 3. Kính gửi & Lời mở đầu
  elements.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Kính gửi: ', bold: true, size: 22, font: 'Times New Roman' }),
        new TextRun({ text: 'Ông/Bà .....................................................................................................................', size: 22, font: 'Times New Roman' }),
      ],
      spacing: { after: 60 },
    })
  );

  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Nhà trường trân trọng thông báo kết quả học tập/kiểm tra của học sinh như sau:',
          italics: true,
          size: 22,
          font: 'Times New Roman',
        }),
      ],
      spacing: { after: 120 },
    })
  );

  // 4. Bảng 1: Thông tin học sinh (2 cột)
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS_ALL,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Họ và tên học sinh: ', bold: true, size: 21, font: 'Times New Roman' }),
                    new TextRun({ text: st.name.toUpperCase(), bold: true, color: NAVY_COLOR, size: 21, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Ngày sinh: ', bold: true, size: 21, font: 'Times New Roman' }),
                    new TextRun({ text: st.dob || '......../......../............', size: 21, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Lớp: ', bold: true, size: 21, font: 'Times New Roman' }),
                    new TextRun({ text: st.className, bold: true, size: 21, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Trường: ', bold: true, size: 21, font: 'Times New Roman' }),
                    new TextRun({ text: school, size: 21, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Kỳ kiểm tra/kỳ thi: ', bold: true, size: 21, font: 'Times New Roman' }),
                    new TextRun({ text: session.name, size: 21, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 70, bottom: 70, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Ngày kiểm tra: ', bold: true, size: 21, font: 'Times New Roman' }),
                    new TextRun({ text: examDate, size: 21, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // 5. Tiêu đề KẾT QUẢ ĐIỂM VÀ XẾP HẠNG
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'KẾT QUẢ ĐIỂM VÀ XẾP HẠNG',
          bold: true,
          size: 26, // 13pt
          color: NAVY_COLOR,
          font: 'Times New Roman',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 100 },
    })
  );

  // 6. Bảng 2: Điểm và Xếp thứ
  // Cột: Môn học (1), Danh sách môn (M), Tổng điểm (1), Ghi chú (1)
  const subjects = session.subjects;
  const totalCols = 1 + subjects.length + 2; // Môn học + subs + Tổng điểm + Ghi chú

  // Header row
  const headerCells = [
    new TableCell({
      shading: { fill: 'F2F4F7' },
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Môn học', bold: true, size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    ...subjects.map(
      (sub) =>
        new TableCell({
          shading: { fill: 'F2F4F7' },
          margins: { top: 60, bottom: 60, left: 40, right: 40 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: sub, bold: true, size: 20, font: 'Times New Roman' })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        })
    ),
    new TableCell({
      shading: { fill: 'EBF3FB' },
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Tổng điểm', bold: true, size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    new TableCell({
      shading: { fill: 'F2F4F7' },
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Ghi chú', bold: true, size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
  ];

  // Scores row
  const scoreCells = [
    new TableCell({
      margins: { top: 70, bottom: 70, left: 50, right: 50 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Điểm', bold: true, size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    ...subjects.map((sub) => {
      const sc = st.scores[sub];
      const scText = sc !== null && sc !== undefined ? sc.toFixed(1) : '-';
      return new TableCell({
        margins: { top: 70, bottom: 70, left: 40, right: 40 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: scText,
                bold: true,
                size: 21,
                font: 'Times New Roman',
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
      });
    }),
    new TableCell({
      margins: { top: 70, bottom: 70, left: 50, right: 50 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: st.totalScore.toFixed(2),
              bold: true,
              color: NAVY_COLOR,
              size: 22,
              font: 'Times New Roman',
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    new TableCell({
      margins: { top: 70, bottom: 70, left: 50, right: 50 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: st.notes || '',
              size: 19,
              font: 'Times New Roman',
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
  ];

  // Rank Headers row (Spanned across columns)
  // Chia đều tổng số cột totalCols cho 3 mục: Xếp thứ trong lớp, Xếp thứ toàn trường, Tổng số học sinh
  const span1 = Math.max(1, Math.floor(totalCols / 3));
  const span2 = Math.max(1, Math.floor(totalCols / 3));
  const span3 = totalCols - span1 - span2;

  const rankHeaderCells = [
    new TableCell({
      columnSpan: span1,
      shading: { fill: 'ECFDF5' },
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Xếp thứ trong lớp', bold: true, size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    new TableCell({
      columnSpan: span2,
      shading: { fill: 'FEF3C7' },
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Xếp thứ toàn trường', bold: true, size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    new TableCell({
      columnSpan: span3,
      shading: { fill: 'F1F5F9' },
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Tổng số học sinh', bold: true, size: 20, font: 'Times New Roman' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
  ];

  // Rank Values row
  const rankValueCells = [
    new TableCell({
      columnSpan: span1,
      margins: { top: 70, bottom: 70, left: 40, right: 40 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `${st.classRank} / ${classTotal}`,
              bold: true,
              size: 21,
              font: 'Times New Roman',
              color: '047857',
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    new TableCell({
      columnSpan: span2,
      margins: { top: 70, bottom: 70, left: 40, right: 40 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `${st.schoolRank} / ${schoolTotal}`,
              bold: true,
              size: 21,
              font: 'Times New Roman',
              color: 'B45309',
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
    new TableCell({
      columnSpan: span3,
      margins: { top: 70, bottom: 70, left: 40, right: 40 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `${classTotal} HS (Lớp) - ${schoolTotal} HS (Trường)`,
              size: 20,
              font: 'Times New Roman',
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    }),
  ];

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS_ALL,
      rows: [
        new TableRow({ children: headerCells }),
        new TableRow({ children: scoreCells }),
        new TableRow({ children: rankHeaderCells }),
        new TableRow({ children: rankValueCells }),
      ],
    })
  );

  // 7. Nhận xét của giáo viên chủ nhiệm
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Nhận xét của giáo viên chủ nhiệm:',
          bold: true,
          size: 22,
          font: 'Times New Roman',
        }),
      ],
      spacing: { before: 180, after: 60 },
    })
  );

  if (options.autoComment) {
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: getAutoComment(st),
            italics: true,
            size: 21,
            font: 'Times New Roman',
          }),
        ],
        spacing: { after: 60 },
      })
    );
  } else {
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '......................................................................................................................................................................',
            size: 20,
            font: 'Times New Roman',
            color: '666666',
          }),
        ],
        spacing: { after: 60 },
      })
    );
    elements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '......................................................................................................................................................................',
            size: 20,
            font: 'Times New Roman',
            color: '666666',
          }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  // Thông tin bổ sung (nếu có)
  elements.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Thông tin bổ sung (nếu có): ', bold: true, size: 21, font: 'Times New Roman' }),
        new TextRun({
          text: '.............................................................................................................................',
          size: 20,
          font: 'Times New Roman',
          color: '666666',
        }),
      ],
      spacing: { after: 180 },
    })
  );

  // 8. Chữ ký 3 cột (GVCN, ĐẠI DIỆN NHÀ TRƯỜNG, PHỤ HUYNH)
  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_BORDERS_NONE,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              borders: TABLE_BORDERS_NONE,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'GIÁO VIÊN CHỦ NHIỆM', bold: true, size: 21, font: 'Times New Roman' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 19, font: 'Times New Roman', color: '555555' })],
                  alignment: AlignmentType.CENTER,
                }),
                ...(options.homeroomTeacherSignatureImage
                  ? [
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: options.homeroomTeacherSignatureImage,
                            transformation: { width: 110, height: 48 },
                            type: getImageType(options.homeroomTeacherSignatureImage),
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80, after: 80 },
                      }),
                    ]
                  : [new Paragraph({ text: '', spacing: { before: 200, after: 200 } })]),
                new Paragraph({
                  children: teacherName ? [new TextRun({ text: teacherName, bold: true, size: 21, font: 'Times New Roman' })] : [],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              width: { size: 34, type: WidthType.PERCENTAGE },
              borders: TABLE_BORDERS_NONE,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'ĐẠI DIỆN NHÀ TRƯỜNG', bold: true, size: 21, font: 'Times New Roman' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: '(Ký, đóng dấu)', italics: true, size: 19, font: 'Times New Roman', color: '555555' })],
                  alignment: AlignmentType.CENTER,
                }),
                ...(options.schoolRepresentativeSignatureImage
                  ? [
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: options.schoolRepresentativeSignatureImage,
                            transformation: { width: 95, height: 50 },
                            type: getImageType(options.schoolRepresentativeSignatureImage),
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80, after: 80 },
                      }),
                    ]
                  : [new Paragraph({ text: '', spacing: { before: 200, after: 200 } })]),
                new Paragraph({
                  children: options.schoolRepresentativeName?.trim()
                    ? [new TextRun({ text: options.schoolRepresentativeName.trim(), bold: true, size: 21, font: 'Times New Roman' })]
                    : [],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              borders: TABLE_BORDERS_NONE,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'PHỤ HUYNH HỌC SINH', bold: true, size: 21, font: 'Times New Roman' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 19, font: 'Times New Roman', color: '555555' })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // 9. Dòng ngày tháng ở chân trang bên phải
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: signDate,
          italics: true,
          size: 20,
          font: 'Times New Roman',
          color: '333333',
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 180 },
    })
  );

  return elements;
}

/**
 * Xuất file Word (.docx) chứa danh sách phiếu báo điểm (mỗi học sinh 1 trang riêng biệt)
 */
export async function exportGradeSlipsToWord(
  students: Student[],
  session: StatisticSession,
  options: GradeSlipOptions = {},
  fileName = 'Phieu_Bao_Diem.docx'
): Promise<void> {
  const schoolTotal = session.students.length;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 22,
          },
        },
      },
    },
    sections: students.map((st) => {
      const classTotal = session.students.filter((s) => s.className === st.className).length;
      return {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1150,
              right: 1150,
            },
            size: {
              width: 11906, // A4 Width in twips
              height: 16838, // A4 Height in twips
            },
          },
        },
        children: buildStudentDocxElements(st, session, options, classTotal, schoolTotal),
      };
    }),
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}

/**
 * Tạo mã HTML hoàn chỉnh để in trực tiếp các phiếu báo điểm (chuẩn A4, mỗi HS 1 trang)
 */
export function generateGradeSlipsPrintHTML(
  students: Student[],
  session: StatisticSession,
  options: GradeSlipOptions = {}
): string {
  const department = options.departmentName || 'UBND xã..........................';
  const school = options.schoolName || session.schoolName || 'TRƯỜNG ....................................';
  const academicYear = options.academicYear || session.academicYear || '20... – 20...';
  const examDate = options.examDate || '......../......../............';
  const signDate = options.signDate || '...................., ngày ...... tháng ...... năm 20......';
  const schoolTotal = session.students.length;

  const cardsHTML = students
    .map((st, idx) => {
      const classTotal = session.students.filter((s) => s.className === st.className).length;
      // Bỏ trống tên GVCN trong phiếu báo điểm để ký tay và ghi rõ họ tên
      const teacherName = options.homeroomTeacherName?.trim() || '';
      const subjects = session.subjects;
      const autoCommentText = options.autoComment ? getAutoComment(st) : '';

      return `
      <div class="grade-slip-card ${idx < students.length - 1 ? 'page-break' : ''}">
        <!-- 1. Header -->
        <div class="slip-header-grid">
          <div class="header-left">
            <div class="dept-text">${department.toUpperCase()}</div>
            <div class="school-text">TRƯỜNG: ${school.toUpperCase()}</div>
            <div class="header-divider-left">-------------------------</div>
          </div>
          <div class="header-right">
            <div class="country-text">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div class="motto-text">Độc lập – Tự do – Hạnh phúc</div>
            <div class="header-divider-right">-----------------------------</div>
          </div>
        </div>

        <!-- 2. Tiêu đề -->
        <div class="slip-title-container">
          <h1 class="slip-title">GIẤY BÁO ĐIỂM</h1>
          <div class="slip-year">Năm học ${academicYear}</div>
        </div>

        <!-- 3. Kính gửi -->
        <div class="salutation-block">
          <div class="salutation-row">
            <span class="bold">Kính gửi:</span> Ông/Bà <span class="dotted-fill">...........................................................................................................</span>
          </div>
          <div class="salutation-intro">
            Nhà trường trân trọng thông báo kết quả học tập/kiểm tra của học sinh như sau:
          </div>
        </div>

        <!-- 4. Bảng thông tin học sinh -->
        <table class="info-table">
          <tr>
            <td style="width: 50%;">
              <span class="bold">Họ và tên học sinh:</span>
              <span class="student-name">${st.name.toUpperCase()}</span>
            </td>
            <td style="width: 50%;">
              <span class="bold">Ngày sinh:</span> ${st.dob || '......../......../............'}
            </td>
          </tr>
          <tr>
            <td>
              <span class="bold">Lớp:</span> <span class="bold">${st.className}</span>
            </td>
            <td>
              <span class="bold">Trường:</span> ${school}
            </td>
          </tr>
          <tr>
            <td>
              <span class="bold">Kỳ kiểm tra/kỳ thi:</span> ${session.name}
            </td>
            <td>
              <span class="bold">Ngày kiểm tra:</span> ${examDate}
            </td>
          </tr>
        </table>

        <!-- 5. Tiêu đề bảng điểm -->
        <div class="score-section-title">KẾT QUẢ ĐIỂM VÀ XẾP HẠNG</div>

        <!-- 6. Bảng điểm và xếp thứ -->
        <table class="scores-table">
          <thead>
            <tr>
              <th class="th-subject">Môn học</th>
              ${subjects.map((sub) => `<th>${sub}</th>`).join('')}
              <th class="th-total">Tổng điểm</th>
              <th class="th-notes">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="bold td-label">Điểm</td>
              ${subjects
                .map((sub) => {
                  const sc = st.scores[sub];
                  return `<td class="score-val">${sc !== null && sc !== undefined ? sc.toFixed(1) : '-'}</td>`;
                })
                .join('')}
              <td class="total-val">${st.totalScore.toFixed(2)}</td>
              <td class="notes-val">${st.notes || ''}</td>
            </tr>
            <tr class="rank-header-row">
              <td colspan="${Math.max(1, Math.floor((subjects.length + 3) / 3))}" class="rank-th class-rank-th">
                Xếp thứ trong lớp
              </td>
              <td colspan="${Math.max(1, Math.floor((subjects.length + 3) / 3))}" class="rank-th school-rank-th">
                Xếp thứ toàn trường
              </td>
              <td colspan="${Math.max(
                1,
                subjects.length + 3 - 2 * Math.max(1, Math.floor((subjects.length + 3) / 3))
              )}" class="rank-th total-rank-th">
                Tổng số học sinh
              </td>
            </tr>
            <tr class="rank-val-row">
              <td colspan="${Math.max(1, Math.floor((subjects.length + 3) / 3))}" class="rank-val class-rank-val">
                #${st.classRank} / ${classTotal}
              </td>
              <td colspan="${Math.max(1, Math.floor((subjects.length + 3) / 3))}" class="rank-val school-rank-val">
                #${st.schoolRank} / ${schoolTotal}
              </td>
              <td colspan="${Math.max(
                1,
                subjects.length + 3 - 2 * Math.max(1, Math.floor((subjects.length + 3) / 3))
              )}" class="rank-val total-val-cell">
                ${classTotal} HS (Lớp) - ${schoolTotal} HS (Trường)
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 7. Nhận xét của GVCN -->
        <div class="comment-section">
          <div class="comment-title">Nhận xét của giáo viên chủ nhiệm:</div>
          ${
            autoCommentText
              ? `<div class="auto-comment-content">${autoCommentText}</div>`
              : `
            <div class="dotted-line">......................................................................................................................................................................</div>
            <div class="dotted-line">......................................................................................................................................................................</div>
          `
          }
          <div class="additional-info">
            <span class="bold">Thông tin bổ sung (nếu có):</span>
            <span class="dotted-fill">...................................................................................................................</span>
          </div>
        </div>

        <!-- 8. Chữ ký 3 cột -->
        <div class="signature-grid">
          <div class="sig-col">
            <div class="sig-title">GIÁO VIÊN CHỦ NHIỆM</div>
            <div class="sig-sub">(Ký, ghi rõ họ tên)</div>
            <div class="sig-space">
              ${options.homeroomTeacherSignatureImage ? `<img src="${options.homeroomTeacherSignatureImage}" alt="Chữ ký GVCN" class="sig-img" />` : ''}
              ${teacherName ? `<div class="sig-name">${teacherName}</div>` : ''}
            </div>
          </div>
          <div class="sig-col">
            <div class="sig-title">ĐẠI DIỆN NHÀ TRƯỜNG</div>
            <div class="sig-sub">(Ký, đóng dấu)</div>
            <div class="sig-space">
              ${options.schoolRepresentativeSignatureImage ? `<img src="${options.schoolRepresentativeSignatureImage}" alt="Dấu / Chữ ký đại diện" class="sig-img stamp-img" />` : ''}
              ${options.schoolRepresentativeName?.trim() ? `<div class="sig-name">${options.schoolRepresentativeName.trim()}</div>` : ''}
            </div>
          </div>
          <div class="sig-col">
            <div class="sig-title">PHỤ HUYNH HỌC SINH</div>
            <div class="sig-sub">(Ký, ghi rõ họ tên)</div>
            <div class="sig-space"></div>
          </div>
        </div>

        <!-- 9. Dòng ngày tháng chân trang -->
        <div class="date-footer">
          ${signDate}
        </div>
      </div>
    `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <title>Phiếu Báo Điểm Học Sinh - ${session.name}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 15mm 12mm 15mm;
        }
        * {
          box-sizing: border-box;
          font-family: 'Times New Roman', 'Tinos', Times, 'Liberation Serif', serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Times New Roman', 'Tinos', Times, 'Liberation Serif', serif !important;
          font-size: 11pt;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 0;
        }
        table, th, td, p, span, div, h1, h2, h3 {
          font-family: 'Times New Roman', 'Tinos', Times, 'Liberation Serif', serif !important;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        .grade-slip-card {
          width: 100%;
          min-height: 260mm;
          max-height: 275mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2mm 0;
        }
        .slip-header-grid {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .header-left {
          text-align: center;
          width: 48%;
        }
        .header-right {
          text-align: center;
          width: 50%;
        }
        .dept-text {
          font-size: 10.5pt;
          font-weight: bold;
        }
        .school-text {
          font-size: 10.5pt;
          font-weight: bold;
          margin-top: 2px;
        }
        .country-text {
          font-size: 10.5pt;
          font-weight: bold;
        }
        .motto-text {
          font-size: 10.5pt;
          font-weight: bold;
          margin-top: 2px;
        }
        .header-divider-left, .header-divider-right {
          font-size: 8pt;
          color: #666;
          line-height: 10px;
        }
        .slip-title-container {
          text-align: center;
          margin: 6px 0 10px 0;
        }
        .slip-title {
          font-size: 18pt;
          font-weight: bold;
          color: #1f4e79;
          margin: 0;
          letter-spacing: 0.5px;
        }
        .slip-year {
          font-size: 11pt;
          font-weight: bold;
          margin-top: 3px;
        }
        .salutation-block {
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .salutation-row {
          font-size: 11pt;
        }
        .salutation-intro {
          font-size: 10.5pt;
          font-style: italic;
          margin-top: 3px;
        }
        .bold {
          font-weight: bold;
        }
        .student-name {
          font-weight: bold;
          color: #1f4e79;
          font-size: 11.5pt;
          margin-left: 4px;
        }
        table.info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        table.info-table td {
          border: 1px solid #333;
          padding: 5px 8px;
          font-size: 10.5pt;
        }
        .score-section-title {
          text-align: center;
          font-size: 13pt;
          font-weight: bold;
          color: #1f4e79;
          margin: 8px 0 6px 0;
          letter-spacing: 0.3px;
        }
        table.scores-table {
          width: 100%;
          border-collapse: collapse;
          text-align: center;
          margin-bottom: 12px;
        }
        table.scores-table th, table.scores-table td {
          border: 1px solid #333;
          padding: 4.5px 3px;
          font-size: 10pt;
        }
        table.scores-table th {
          background-color: #f2f4f7 !important;
          font-weight: bold;
        }
        .th-total {
          background-color: #ebf3fb !important;
        }
        .td-label {
          background-color: #fafafa !important;
        }
        .score-val {
          font-weight: bold;
        }
        .total-val {
          font-weight: bold;
          color: #1f4e79;
          background-color: #f8fafc !important;
          font-size: 10.5pt;
        }
        .notes-val {
          font-size: 9.5pt;
        }
        .rank-th {
          font-weight: bold;
          font-size: 10pt;
        }
        .class-rank-th {
          background-color: #ecfdf5 !important;
          color: #065f46;
        }
        .school-rank-th {
          background-color: #fef3c7 !important;
          color: #92400e;
        }
        .total-rank-th {
          background-color: #f1f5f9 !important;
        }
        .rank-val {
          font-size: 10.5pt;
          font-weight: bold;
          padding: 5px 3px !important;
        }
        .class-rank-val {
          color: #047857;
        }
        .school-rank-val {
          color: #b45309;
        }
        .comment-section {
          margin-bottom: 12px;
          line-height: 1.5;
        }
        .comment-title {
          font-weight: bold;
          font-size: 11pt;
          margin-bottom: 4px;
        }
        .auto-comment-content {
          font-style: italic;
          padding: 4px 6px;
          background-color: #f8fafc;
          border-left: 2px solid #1f4e79;
          margin-bottom: 4px;
        }
        .dotted-line {
          color: #666;
          font-size: 10pt;
          letter-spacing: 1px;
          margin-bottom: 4px;
          overflow: hidden;
          white-space: nowrap;
        }
        .additional-info {
          font-size: 10.5pt;
          margin-top: 5px;
        }
        .signature-grid {
          display: flex;
          justify-content: space-between;
          text-align: center;
          margin-top: 10px;
          margin-bottom: 8px;
        }
        .sig-col {
          width: 32%;
          text-align: center;
        }
        .sig-title {
          font-weight: bold;
          font-size: 10.5pt;
        }
        .sig-sub {
          font-style: italic;
          font-size: 9.5pt;
          color: #444;
          margin-top: 2px;
        }
        .sig-space {
          min-height: 68px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          position: relative;
        }
        .sig-img {
          max-height: 48px;
          max-width: 120px;
          object-fit: contain;
          margin-bottom: 3px;
        }
        .sig-img.stamp-img {
          max-height: 52px;
          max-width: 110px;
        }
        .sig-name {
          font-weight: bold;
          font-size: 10pt;
          color: #000;
          text-align: center;
        }
        .date-footer {
          text-align: right;
          font-style: italic;
          font-size: 10pt;
          margin-top: 6px;
          padding-right: 10px;
        }
      </style>
    </head>
    <body>
      ${cardsHTML}
    </body>
    </html>
  `;
}

/**
 * Thực hiện in trực tiếp danh sách phiếu báo điểm qua universal printService
 * Kích hoạt hộp thoại in ấn chuẩn của trình duyệt (chọn máy in, khổ giấy, số bản in, xem trước)
 */
export function printGradeSlips(
  students: Student[],
  session: StatisticSession,
  options: GradeSlipOptions = {},
  onDone?: () => void
): void {
  const fullHTML = generateGradeSlipsPrintHTML(students, session, options);
  printHTML(fullHTML, {
    orientation: 'portrait',
    paperSize: 'a4',
    title: `Phieu_Bao_Diem_${session.name}`,
    onAfterPrint: onDone,
  });
}
