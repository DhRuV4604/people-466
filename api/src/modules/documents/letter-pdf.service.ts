import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { companyAddressLines, type CompanyDto } from '@peoplepay360/shared';
import { CompanyService } from '../config/company.service';

const BRAND = '#6d28d9';
const INK = '#111827';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const LINE = '#e5e7eb';

const MARGIN = 64;
const PAGE_WIDTH = 595.28;
const CONTENT = PAGE_WIDTH - MARGIN * 2;

/**
 * Turns generated text into a document that looks like one.
 *
 * pdfkit rather than pdf-lib here because this builds a page from nothing;
 * pdf-lib is for adding the certificate to a PDF that already exists. Both
 * produce a PDF, so the signing flow does not care which made it.
 *
 * Set on a wider margin than the payslip. A payslip is a table and wants the
 * room; a letter is prose, and a line of text much past 90 characters is
 * tiring to read.
 */
@Injectable()
export class LetterPdfService {
  constructor(private readonly company: CompanyService) {}

  async render(params: {
    title: string;
    body: string;
    company: CompanyDto;
    reference: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const { company, title, body, reference } = params;
    const logo = await this.company.logoBuffer();

    // ---------------------------------------------------------- Letterhead
    let y = MARGIN;

    if (logo) {
      try {
        doc.image(logo, MARGIN, y, { fit: [36, 36] });
      } catch {
        // Not worth failing a letter over an undecodable image.
      }
    }

    const left = logo ? MARGIN + 48 : MARGIN;
    doc.fillColor(INK).fontSize(14).font('Helvetica-Bold').text(company.name, left, y + 2);

    const address = companyAddressLines(company);
    if (address.length > 0) {
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font('Helvetica')
        .text(address.join(', '), left, y + 20, { width: CONTENT * 0.62 });
    }

    // Contact details sit opposite the name, the way a printed letterhead
    // carries them.
    const contact = [company.phone, company.email, company.website].filter(Boolean);
    if (contact.length > 0) {
      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font('Helvetica')
        .text(contact.join('\n'), MARGIN, y + 2, { width: CONTENT, align: 'right' });
    }

    y += 52;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT, y).strokeColor(BRAND).lineWidth(2).stroke();

    // ---------------------------------------------------------- The letter
    y += 22;
    doc
      .fillColor(FAINT)
      .fontSize(8)
      .font('Helvetica')
      .text(reference, MARGIN, y, { width: CONTENT / 2 });
    doc
      .fillColor(FAINT)
      .fontSize(8)
      .text(
        new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        MARGIN,
        y,
        { width: CONTENT, align: 'right' }
      );

    y += 26;
    doc.fillColor(INK).fontSize(17).font('Helvetica-Bold').text(title, MARGIN, y, {
      width: CONTENT,
    });

    y = doc.y + 14;
    doc.y = y;
    doc.fillColor(INK).fontSize(10.5).font('Helvetica');

    // Written paragraph by paragraph so the blank lines the model produced
    // survive; pdfkit collapses them otherwise and the letter arrives as one
    // unreadable block.
    for (const paragraph of body.split(/\n{2,}/)) {
      const text = paragraph.trim();
      if (!text) continue;

      if (doc.y > doc.page.height - MARGIN - 60) {
        doc.addPage();
        doc.y = MARGIN;
      }

      doc.text(text, MARGIN, doc.y, {
        width: CONTENT,
        align: 'left',
        lineGap: 4,
        paragraphGap: 0,
      });
      doc.moveDown(0.9);
    }

    // -------------------------------------------------------------- Footer
    //
    // Kept inside the bottom margin. Writing below it makes pdfkit start a new
    // page for the overflow, which is how a one-page letter came out as three.
    const bottom = doc.page.height - MARGIN;
    doc
      .moveTo(MARGIN, bottom - 26)
      .lineTo(MARGIN + CONTENT, bottom - 26)
      .strokeColor(LINE)
      .lineWidth(1)
      .stroke();
    doc
      .fillColor(FAINT)
      .fontSize(7.5)
      .font('Helvetica')
      .text(company.legalName ?? company.name, MARGIN, bottom - 18, {
        width: CONTENT,
        lineBreak: false,
      });
    if (company.taxId) {
      doc.text(`Tax ID ${company.taxId}`, MARGIN, bottom - 18, {
        width: CONTENT,
        align: 'right',
        lineBreak: false,
      });
    }

    doc.end();
    return finished;
  }
}
