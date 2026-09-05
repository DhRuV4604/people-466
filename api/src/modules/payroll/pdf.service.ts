import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { isNegativeCategory, CATEGORY_LABELS } from '@peoplepay360/shared';
import { companyAddressLines } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../config/company.service';
import { toNumber } from '../../common/decimal';

const BRAND = '#6d28d9';
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const CURRENCY = 'Rs.';

function formatMoney(amount: number): string {
  return `${CURRENCY}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function maskAccount(account: string): string {
  if (account.length <= 4) return account;
  return `${'*'.repeat(Math.max(0, account.length - 4))}${account.slice(-4)}`;
}

@Injectable()
export class PdfService {
  constructor(private readonly prisma: PrismaService,
    private readonly company: CompanyService
  ) {}

  /** Render a payslip to a PDF buffer for download or as an email attachment. */
  async generatePayslip(payslipId: string): Promise<{ buffer: Buffer; filename: string }> {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id: payslipId },
      include: {
        employee: { include: { department: true, jobPosition: true } },
        contract: true,
        structure: true,
        payrun: true,
        lines: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!payslip) throw new NotFoundException('Payslip not found.');

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const pageWidth = doc.page.width - 96;
    const emp = payslip.employee;

    // ---- Header band
    const company = await this.company.get();
    const logo = await this.company.logoBuffer();

    doc.rect(0, 0, doc.page.width, 96).fill(BRAND);

    // The logo displaces the name rather than sitting beside it: two marks of
    // identity in one corner reads as a mistake.
    let textLeft = 48;
    if (logo) {
      try {
        doc.image(logo, 48, 26, { fit: [44, 44], valign: 'center' });
        textLeft = 104;
      } catch {
        // An image pdfkit cannot decode is not a reason to fail a payslip.
      }
    }

    doc
      .fillColor('#ffffff')
      .fontSize(logo ? 18 : 22)
      .font('Helvetica-Bold')
      .text(company.name, textLeft, logo ? 34 : 30, { width: 300, lineBreak: false });
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(
        companyAddressLines(company).join(' · ') || 'HR & Payroll Operations',
        textLeft,
        logo ? 58 : 58,
        { width: 300, lineBreak: false }
      );
    doc
      .fontSize(15)
      .font('Helvetica-Bold')
      .text('PAYSLIP', 48, 30, { width: pageWidth, align: 'right' });
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(payslip.number, 48, 52, { width: pageWidth, align: 'right' })
      .text(
        `${formatDate(payslip.periodStart)} - ${formatDate(payslip.periodEnd)}`,
        48,
        66,
        { width: pageWidth, align: 'right' }
      );

    doc.y = 124;

    // ---- Employee and run details in two columns
    const colLeft = 48;
    const colRight = 48 + pageWidth / 2;
    const detailTop = doc.y;

    const detail = (x: number, y: number, label: string, value: string) => {
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(label.toUpperCase(), x, y);
      doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text(value || '-', x, y + 11);
    };

    detail(colLeft, detailTop, 'Employee', `${emp.firstName} ${emp.lastName}`);
    detail(colLeft, detailTop + 32, 'Employee Code', emp.employeeCode);
    detail(colLeft, detailTop + 64, 'Department', emp.department?.name ?? '-');
    detail(colLeft, detailTop + 96, 'Designation', emp.jobPosition?.name ?? '-');

    detail(colRight, detailTop, 'Pay Run', payslip.payrun?.name ?? 'Standalone');
    detail(colRight, detailTop + 32, 'Salary Structure', payslip.structure.name);
    detail(colRight, detailTop + 64, 'Status', payslip.status);
    detail(
      colRight,
      detailTop + 96,
      'Worked Days',
      `${toNumber(payslip.workedDays)} day(s) - ${toNumber(payslip.workedHours)}h`
    );

    doc.y = detailTop + 136;
    doc.moveTo(48, doc.y).lineTo(48 + pageWidth, doc.y).strokeColor(LINE).lineWidth(1).stroke();
    doc.y += 18;

    // ---- Salary computation table
    doc.fillColor(INK).fontSize(12).font('Helvetica-Bold').text('Salary Computation', 48, doc.y);
    doc.y += 18;

    const cols = { name: 48, category: 250, qty: 350, rate: 410, amount: 470 };

    doc.rect(48, doc.y, pageWidth, 20).fill('#f3f4f6');
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

      const amount = toNumber(line.amount);
      const rate = toNumber(line.rate);
      const negative = isNegativeCategory(line.category);
      const displayAmount = `${negative ? '-' : ''}${formatMoney(Math.abs(amount))}`;
      const y = doc.y;

      doc.fillColor(INK).fontSize(9).font('Helvetica-Bold').text(line.name, cols.name + 6, y, {
        width: 190,
      });
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font('Helvetica')
        .text(CATEGORY_LABELS[line.category] ?? line.category, cols.category, y + 1);
      doc.text(String(toNumber(line.quantity)), cols.qty, y + 1, { width: 50, align: 'right' });
      doc.text(rate !== 100 ? `${rate}%` : '-', cols.rate, y + 1, { width: 50, align: 'right' });
      doc
        .fillColor(negative ? '#b91c1c' : INK)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(displayAmount, cols.amount, y, { width: 76, align: 'right' });

      doc.y = y + 18;
      doc.moveTo(48, doc.y - 4).lineTo(48 + pageWidth, doc.y - 4).strokeColor('#f3f4f6').stroke();
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

    totalRow('Basic', formatMoney(toNumber(payslip.basicWage)));
    totalRow('Gross Pay', formatMoney(toNumber(payslip.grossPay)));
    totalRow(
      'Total Deductions',
      `-${formatMoney(toNumber(payslip.totalDeductions))}`,
      false,
      '#b91c1c'
    );

    doc.y += 4;
    doc.rect(totalsX, doc.y, totalsWidth, 30).fill(BRAND);
    doc
      .fillColor('#ffffff')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('NET PAY', totalsX + 10, doc.y + 10);
    doc.text(formatMoney(toNumber(payslip.netPay)), totalsX, doc.y + 10, {
      width: totalsWidth - 10,
      align: 'right',
    });
    doc.y += 44;

    // ---- Bank line and footer
    doc.fillColor(MUTED).fontSize(8).font('Helvetica');
    doc.text(
      `Payment to: ${emp.bankName ?? 'Bank details not on file'}${
        emp.bankAccountNumber ? ` - A/C ${maskAccount(emp.bankAccountNumber)}` : ''
      }`,
      48,
      doc.y
    );
    doc.y += 12;
    doc.text('This is a computer-generated payslip and does not require a signature.', 48, doc.y);

    doc.end();
    const buffer = await done;

    const safeName = `${emp.firstName}-${emp.lastName}`.replace(/[^a-zA-Z0-9-]/g, '');
    const filename = `Payslip-${safeName}-${payslip.number.replace(/\//g, '-')}.pdf`;

    return { buffer, filename };
  }
}
