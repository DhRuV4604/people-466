import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

const BRAND = '#6d28d9';
const INK = '#111827';
const MUTED = '#6b7280';

/**
 * Turns generated text into a document that looks like one.
 *
 * pdfkit rather than pdf-lib here because this builds a page from nothing;
 * pdf-lib is for adding the certificate to a PDF that already exists. Both
 * produce a PDF, so the signing flow does not care which made it.
 */
@Injectable()
export class LetterPdfService {
  async render(params: {
    title: string;
    body: string;
    companyName: string;
    reference: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text(params.companyName);
    doc
      .fillColor(MUTED)
      .fontSize(9)
      .font('Helvetica')
      .text(
        `${params.reference}  ·  ${new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}`
      );

    doc.moveDown(2);
    doc.fillColor(INK).fontSize(18).font('Helvetica-Bold').text(params.title);
    doc.moveDown(1.2);

    // Written paragraph by paragraph so the blank lines the model produced
    // survive; pdfkit collapses them otherwise and the letter arrives as one
    // unreadable block.
    doc.fontSize(11).font('Helvetica').fillColor(INK);
    for (const paragraph of params.body.split(/\n{2,}/)) {
      doc.text(paragraph.trim(), { align: 'left', lineGap: 3 });
      doc.moveDown(0.8);
    }

    doc.end();
    return finished;
  }
}
