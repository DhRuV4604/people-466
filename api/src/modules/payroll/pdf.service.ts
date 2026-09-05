import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { isNegativeCategory } from '@peoplepay360/shared';
import { companyAddressLines } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../config/company.service';
import { toNumber } from '../../common/decimal';

const BRAND = '#6d28d9';
const INK = '#111827';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const LINE = '#e5e7eb';
const NEGATIVE = '#b42318';

/**
 * "Rs" rather than the rupee sign.
 *
 * pdfkit's built-in Helvetica is WinAnsi, which has no U+20B9; the glyph comes
 * out as a box. Embedding a font for one character is not worth the megabyte.
 */
const CURRENCY = 'Rs';

const MARGIN = 48;
const PAGE_WIDTH = 595.28;
const CONTENT = PAGE_WIDTH - MARGIN * 2;

function money(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function maskAccount(account: string): string {
  if (account.length <= 4) return account;
  return `****${account.slice(-4)}`;
}

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty',
  'ninety',
];

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens}-${ones}` : tens;
}

/**
 * The amount written out, in lakhs and crores.
 *
 * Expected on an Indian payslip, and it is the line that makes a tampered
 * figure obvious: changing "1,14,903.34" is easy, changing it and the words
 * beneath it consistently is not.
 */
function inWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - whole) * 100);

  const parts: string[] = [];
  const push = (value: number, label: string) => {
    if (value > 0) parts.push(`${underHundred(value)} ${label}`);
  };

  push(Math.floor(whole / 10000000), 'crore');
  push(Math.floor((whole % 10000000) / 100000), 'lakh');
  push(Math.floor((whole % 100000) / 1000), 'thousand');
  push(Math.floor((whole % 1000) / 100), 'hundred');

  const last = whole % 100;
  if (last > 0) parts.push(underHundred(last));
  if (parts.length === 0) parts.push('zero');

  const rupees = parts.join(' ');
  const words = paise > 0 ? `${rupees} and ${underHundred(paise)} paise` : rupees;
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} only`;
}

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
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

    const company = await this.company.get();
    const logo = await this.company.logoBuffer();
    const emp = payslip.employee;

    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const rule = (y: number, color = LINE) => {
      doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT, y).strokeColor(color).lineWidth(1).stroke();
    };

    // ---------------------------------------------------------- Letterhead
    //
    // A rule instead of a filled band. The band shouted the brand on a
    // document whose job is to be read and filed, and it left the page
    // top-heavy before a single figure appeared.
    let y = MARGIN;

    if (logo) {
      try {
        doc.image(logo, MARGIN, y, { fit: [38, 38] });
      } catch {
        // An undecodable image is not a reason to fail a payslip.
      }
    }

    const nameLeft = logo ? MARGIN + 50 : MARGIN;
    doc.fillColor(INK).fontSize(15).font('Helvetica-Bold').text(company.name, nameLeft, y + 2);

    const address = companyAddressLines(company);
    if (address.length > 0) {
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font('Helvetica')
        .text(address.join(', '), nameLeft, y + 21, { width: CONTENT * 0.5 });
    }
    if (company.taxId) {
      doc.fillColor(FAINT).fontSize(8).text(`Tax ID ${company.taxId}`, nameLeft, y + 32);
    }

    // The document's own identity, right-aligned against the letterhead.
    doc
      .fillColor(BRAND)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('PAYSLIP', MARGIN, y + 2, { width: CONTENT, align: 'right' });
    doc
      .fillColor(INK)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(payslip.number, MARGIN, y + 19, { width: CONTENT, align: 'right' });
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica')
      .text(
        `${formatDate(payslip.periodStart)} to ${formatDate(payslip.periodEnd)}`,
        MARGIN,
        y + 32,
        { width: CONTENT, align: 'right' }
      );

    y += 54;
    rule(y);
    y += 16;

    // ------------------------------------------------------- Who and which
    const colRight = MARGIN + CONTENT / 2;
    const field = (x: number, top: number, label: string, value: string) => {
      doc.fillColor(FAINT).fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x, top, {
        characterSpacing: 0.6,
      });
      doc
        .fillColor(INK)
        .fontSize(9.5)
        .font('Helvetica-Bold')
        .text(value || '—', x, top + 10, { width: CONTENT / 2 - 16 });
    };

    field(MARGIN, y, 'Employee', `${emp.firstName} ${emp.lastName}`);
    field(colRight, y, 'Pay run', payslip.payrun?.name ?? 'Standalone');
    field(MARGIN, y + 30, 'Employee code', emp.employeeCode);
    field(colRight, y + 30, 'Salary structure', payslip.structure.name);
    field(MARGIN, y + 60, 'Department', emp.department?.name ?? '—');
    field(colRight, y + 60, 'Designation', emp.jobPosition?.name ?? '—');
    field(
      MARGIN,
      y + 90,
      'Days worked',
      `${toNumber(payslip.workedDays)} days · ${toNumber(payslip.workedHours)} h`
    );
    field(colRight, y + 90, 'Status', payslip.status);

    y += 124;
    rule(y);
    y += 20;

    // ------------------------------------------------- Earnings, deductions
    //
    // Two columns rather than one table with quantity and rate columns. Those
    // were mostly "1" and "-", and the one time a quantity was interesting it
    // was a percentage basis printed under a heading that said QTY. A payslip
    // is read to answer "what did I earn and what came off", which is what
    // this shape says.
    const earnings = payslip.lines.filter(
      (l) => l.category === 'BASIC' || l.category === 'ALLOWANCE'
    );
    const deductions = payslip.lines.filter((l) => isNegativeCategory(l.category));

    const gap = 24;
    const colWidth = (CONTENT - gap) / 2;
    const rightX = MARGIN + colWidth + gap;

    const heading = (x: number, top: number, text: string) => {
      doc
        .fillColor(BRAND)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(text.toUpperCase(), x, top, { characterSpacing: 0.8 });
      doc
        .moveTo(x, top + 14)
        .lineTo(x + colWidth, top + 14)
        .strokeColor(BRAND)
        .lineWidth(1)
        .stroke();
    };

    heading(MARGIN, y, 'Earnings');
    heading(rightX, y, 'Deductions');

    const rowsTop = y + 24;
    const rowHeight = 19;

    const column = (x: number, lines: typeof payslip.lines, negative: boolean) => {
      let rowY = rowsTop;

      for (const line of lines) {
        const amount = Math.abs(toNumber(line.amount));
        doc.fillColor(INK).fontSize(9).font('Helvetica').text(line.name, x, rowY, {
          width: colWidth - 92,
          lineBreak: false,
          ellipsis: true,
        });
        doc
          .fillColor(negative ? NEGATIVE : INK)
          .font('Helvetica')
          .text(money(amount), x + colWidth - 92, rowY, { width: 92, align: 'right' });
        rowY += rowHeight;
      }

      // Both columns rule off at the same height, however many rows each has,
      // so the totals line up and the block reads as one thing.
      return rowY;
    };

    const leftEnd = column(MARGIN, earnings, false);
    const rightEnd = column(rightX, deductions, true);
    const totalsY = Math.max(leftEnd, rightEnd) + 4;

    const columnTotal = (x: number, label: string, value: number, negative: boolean) => {
      doc
        .moveTo(x, totalsY)
        .lineTo(x + colWidth, totalsY)
        .strokeColor(LINE)
        .stroke();
      doc
        .fillColor(MUTED)
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text(label.toUpperCase(), x, totalsY + 7, { characterSpacing: 0.5 });
      doc
        .fillColor(negative ? NEGATIVE : INK)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(money(value), x + colWidth - 92, totalsY + 6, { width: 92, align: 'right' });
    };

    columnTotal(MARGIN, 'Gross earnings', toNumber(payslip.grossPay), false);
    columnTotal(rightX, 'Total deductions', toNumber(payslip.totalDeductions), true);

    y = totalsY + 34;

    // ------------------------------------------------------------- Net pay
    //
    // The figure the document exists to communicate, so it is the one thing
    // given weight. It was previously drawn a line below the band it belonged
    // in: pdfkit advances `y` after every `text`, and the second call read the
    // advanced value, putting white text on white paper.
    const netHeight = 46;
    doc.roundedRect(MARGIN, y, CONTENT, netHeight, 8).fill(BRAND);

    doc
      .fillColor('#ffffff')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('NET PAY', MARGIN + 16, y + 12, { characterSpacing: 1, lineBreak: false });
    doc
      .fillColor('#ffffff')
      .fontSize(8)
      .font('Helvetica')
      .text(
        `${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)}`,
        MARGIN + 16,
        y + 26,
        { lineBreak: false }
      );
    doc
      .fillColor('#ffffff')
      .fontSize(19)
      .font('Helvetica-Bold')
      .text(
        `${CURRENCY} ${money(toNumber(payslip.netPay))}`,
        MARGIN + CONTENT / 2,
        y + 14,
        { width: CONTENT / 2 - 16, align: 'right', lineBreak: false }
      );

    y += netHeight + 10;
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica-Oblique')
      .text(inWords(toNumber(payslip.netPay)), MARGIN, y, { width: CONTENT });

    // -------------------------------------------------------------- Footer
    //
    // Pinned to the foot of the page unless the lines have grown far enough
    // down to reach it. A payslip is nearly always one page with room to
    // spare, and a footer floating in the middle of it looks like the document
    // ran out rather than finished.
    y = Math.max(y + 26, doc.page.height - MARGIN - 26);
    rule(y);
    y += 12;

    doc.fillColor(MUTED).fontSize(8).font('Helvetica');
    doc.text(
      emp.bankAccountNumber
        ? `Paid to ${emp.bankName ?? 'bank'} · A/C ${maskAccount(emp.bankAccountNumber)}`
        : 'No bank details on file',
      MARGIN,
      y
    );
    doc.fillColor(FAINT).text(
      'Computer-generated. No signature required.',
      MARGIN,
      y,
      { width: CONTENT, align: 'right' }
    );

    doc.end();
    const buffer = await done;

    const safeName = `${emp.firstName}-${emp.lastName}`.replace(/[^a-zA-Z0-9-]/g, '');
    const filename = `Payslip-${safeName}-${payslip.number.replace(/\//g, '-')}.pdf`;

    return { buffer, filename };
  }
}
