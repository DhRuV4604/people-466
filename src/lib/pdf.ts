import PDFDocument from 'pdfkit';
import { prisma } from './prisma';
import { formatDate, formatMoney } from './utils';
import { isNegativeCategory, CATEGORY_LABELS } from './payroll';

const BRAND = '#6d28d9';
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

/** Render a payslip to a PDF buffer suitable for download or email attachment. */
export async function generatePayslipPDF(payslipId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: { include: { department: true, jobPosition: true } },
      contract: true,
      structure: true,
      payrun: true,
      lines: { orderBy: { sequence: 'asc' } },
    },
  });

  if (!payslip) throw new Error('Payslip not found.');

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const pageWidth = doc.page.width - 96;
  const emp = payslip.employee;

  // ---- Header band
  doc.rect(0, 0, doc.page.width, 96).fill(BRAND);
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('PeoplePay360', 48, 30);
  doc.fontSize(9).font('Helvetica').text('HR & Payroll Operations', 48, 58);
  doc
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('PAYSLIP', 48, 30, { width: pageWidth, align: 'right' });
  doc
    .fontSize(9)
    .font('Helvetica')
    .text(payslip.number, 48, 52, { width: pageWidth, align: 'right' })
    .text(
      `${formatDate(payslip.periodStart)} — ${formatDate(payslip.periodEnd)}`,
      48,
      66,
      { width: pageWidth, align: 'right' }
    );

  doc.y = 124;

  // ---- Employee / run details, two columns
  const colLeft = 48;
  const colRight = 48 + pageWidth / 2;
  const detailTop = doc.y;

  const detail = (x: number, y: number, label: string, value: string) => {
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(label.toUpperCase(), x, y);
    doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text(value || '—', x, y + 11);
  };

  detail(colLeft, detailTop, 'Employee', `${emp.firstName} ${emp.lastName}`);
  detail(colLeft, detailTop + 32, 'Employee Code', emp.employeeCode);
  detail(colLeft, detailTop + 64, 'Department', emp.department?.name ?? '—');
  detail(colLeft, detailTop + 96, 'Designation', emp.jobPosition?.name ?? '—');

  detail(colRight, detailTop, 'Pay Run', payslip.payrun?.name ?? 'Standalone');
  detail(colRight, detailTop + 32, 'Salary Structure', payslip.structure.name);
  detail(colRight, detailTop + 64, 'Status', payslip.status);
  detail(
    colRight,
    detailTop + 96,
    'Worked Days',
    `${payslip.workedDays} day(s) · ${payslip.workedHours}h`
  );

  doc.y = detailTop + 136;
  doc.moveTo(48, doc.y).lineTo(48 + pageWidth, doc.y).strokeColor(LINE).lineWidth(1).stroke();
  doc.y += 18;

  // ---- Salary computation table
  doc.fillColor(INK).fontSize(12).font('Helvetica-Bold').text('Salary Computation', 48, doc.y);
  doc.y += 18;

  const cols = { name: 48, category: 250, qty: 350, rate: 410, amount: 470 };
  const rowWidth = pageWidth;

  doc.rect(48, doc.y, rowWidth, 20).fill('#f3f4f6');
  doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold');
  const headerY = doc.y + 6;
  doc.text('DESCRIPTION', cols.name + 6, headerY);
  doc.text('CATEGORY', cols.category, headerY);
  doc.text('QTY', cols.qty, headerY, { width: 50, align: 'right' });
  doc.text('RATE', cols.rate, headerY, { width: 50, align: 'right' });
  doc.text('AMOUNT', cols.amount, headerY, { width: 76, align: 'right' });
  doc.y += 24;

  for (const line of payslip.lines) {
    if (doc.y > doc.page.height - 160) {
      doc.addPage();
      doc.y = 60;
    }

    const negative = isNegativeCategory(line.category);
    const displayAmount = `${negative ? '-' : ''}${formatMoney(Math.abs(line.amount))}`;
    const y = doc.y;

    doc.fillColor(INK).fontSize(9).font('Helvetica-Bold').text(line.name, cols.name + 6, y, {
      width: 190,
    });
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica')
      .text(CATEGORY_LABELS[line.category] ?? line.category, cols.category, y + 1);
    doc.text(String(line.quantity), cols.qty, y + 1, { width: 50, align: 'right' });
    doc.text(
      line.rate !== 100 ? `${line.rate}%` : '—',
      cols.rate,
      y + 1,
      { width: 50, align: 'right' }
    );
    doc
      .fillColor(negative ? '#b91c1c' : INK)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(displayAmount, cols.amount, y, { width: 76, align: 'right' });

    doc.y = y + 18;
    doc.moveTo(48, doc.y - 4).lineTo(48 + rowWidth, doc.y - 4).strokeColor('#f3f4f6').stroke();
  }

  doc.y += 10;

  // ---- Totals
  const totalsX = 320;
  const totalsWidth = 48 + pageWidth - totalsX;

  const totalRow = (label: string, value: string, bold = false, color = INK) => {
    const y = doc.y;
    doc
      .fillColor(bold ? INK : MUTED)
      .fontSize(bold ? 10 : 9)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(label, totalsX, y, { width: totalsWidth / 2 });
    doc
      .fillColor(color)
      .fontSize(bold ? 10 : 9)
      .font('Helvetica-Bold')
      .text(value, totalsX + totalsWidth / 2, y, {
        width: totalsWidth / 2,
        align: 'right',
      });
    doc.y = y + 16;
  };

  totalRow('Basic', formatMoney(payslip.basicWage));
  totalRow('Gross Pay', formatMoney(payslip.grossPay));
  totalRow('Total Deductions', `-${formatMoney(payslip.totalDeductions)}`, false, '#b91c1c');

  doc.y += 4;
  doc.rect(totalsX, doc.y, totalsWidth, 30).fill(BRAND);
  doc
    .fillColor('#ffffff')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('NET PAY', totalsX + 10, doc.y + 10);
  doc.text(formatMoney(payslip.netPay), totalsX, doc.y + 10, {
    width: totalsWidth - 10,
    align: 'right',
  });
  doc.y += 44;

  // ---- Bank + footer
  doc.fillColor(MUTED).fontSize(8).font('Helvetica');
  doc.text(
    `Payment to: ${emp.bankName ?? 'Bank details not on file'}${
      emp.bankAccountNumber ? ` · A/C ${maskAccount(emp.bankAccountNumber)}` : ''
    }`,
    48,
    doc.y
  );
  doc.y += 12;
  doc.text(
    'This is a computer-generated payslip and does not require a signature.',
    48,
    doc.y
  );

  doc.end();
  const buffer = await done;

  const safeName = `${emp.firstName}-${emp.lastName}`.replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `Payslip-${safeName}-${payslip.number.replace(/\//g, '-')}.pdf`;

  return { buffer, filename };
}

function maskAccount(account: string): string {
  if (account.length <= 4) return account;
  return `${'•'.repeat(Math.max(0, account.length - 4))}${account.slice(-4)}`;
}
