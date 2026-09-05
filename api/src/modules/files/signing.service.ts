import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface SignatureEvidence {
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  ip: string;
  userAgent: string;
  /** Checksum of the document as it stood when it was sent. */
  documentChecksum: string;
  documentTitle: string;
  /** The drawn or typed mark, as a PNG data URL. */
  signatureImage: string;
}

const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.9, 0.91, 0.92);

function formatStamp(date: Date): string {
  return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/**
 * Turns a signed document into one that says so.
 *
 * The original pages are left exactly as they were and the evidence goes on a
 * page of its own at the end. Stamping over the content would change the bytes
 * a person agreed to, which is the one thing a signature record must not do -
 * the checksum on the certificate refers to the file as it was sent, and it has
 * to stay checkable.
 */
@Injectable()
export class SigningService {
  async certify(original: Buffer, evidence: SignatureEvidence): Promise<Buffer> {
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(original);
    } catch {
      throw new BadRequestException(
        'That document could not be read as a PDF, so it cannot be signed. Ask for it as a PDF.'
      );
    }

    const page = pdf.addPage();
    const { width, height } = page.getSize();
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const body = await pdf.embedFont(StandardFonts.Helvetica);
    const mono = await pdf.embedFont(StandardFonts.Courier);

    const left = 56;
    let y = height - 72;

    page.drawText('Certificate of signature', { x: left, y, size: 20, font: bold, color: INK });
    y -= 18;
    page.drawText(evidence.documentTitle.slice(0, 90), { x: left, y, size: 11, font: body, color: MUTED });

    y -= 26;
    page.drawLine({
      start: { x: left, y },
      end: { x: width - left, y },
      thickness: 1,
      color: LINE,
    });

    // The mark itself, above the facts about it.
    y -= 30;
    page.drawText('Signed by', { x: left, y, size: 9, font: bold, color: MUTED });
    y -= 16;
    page.drawText(evidence.signerName, { x: left, y, size: 14, font: bold, color: INK });

    const png = evidence.signatureImage.split(',')[1];
    if (png) {
      const image = await pdf.embedPng(Buffer.from(png, 'base64')).catch(() => null);
      if (image) {
        // Scaled to a fixed height so a wide scrawl and a short one sit the
        // same on the page.
        const drawn = image.scaleToFit(220, 64);
        y -= drawn.height + 12;
        page.drawImage(image, { x: left, y, width: drawn.width, height: drawn.height });
        y -= 8;
        page.drawLine({
          start: { x: left, y },
          end: { x: left + 260, y },
          thickness: 1,
          color: LINE,
        });
      }
    }

    y -= 34;
    const rows: [string, string][] = [
      ['Email', evidence.signerEmail],
      ['Signed at', formatStamp(evidence.signedAt)],
      ['IP address', evidence.ip || 'not recorded'],
      ['Device', evidence.userAgent.slice(0, 78) || 'not recorded'],
    ];
    for (const [label, value] of rows) {
      page.drawText(label, { x: left, y, size: 9, font: bold, color: MUTED });
      page.drawText(value, { x: left + 96, y, size: 9, font: body, color: INK });
      y -= 18;
    }

    y -= 10;
    page.drawText('Document fingerprint (SHA-256)', { x: left, y, size: 9, font: bold, color: MUTED });
    y -= 15;
    // Split, because a 64-character hash does not fit the page in one line and
    // a truncated fingerprint proves nothing.
    page.drawText(evidence.documentChecksum.slice(0, 32), { x: left, y, size: 9, font: mono, color: INK });
    y -= 13;
    page.drawText(evidence.documentChecksum.slice(32), { x: left, y, size: 9, font: mono, color: INK });

    y -= 28;
    page.drawText(
      'This page was added when the document was signed. The fingerprint above is of',
      { x: left, y, size: 8, font: body, color: MUTED }
    );
    y -= 11;
    page.drawText(
      'the document as it was sent; the pages before this one are unchanged.',
      { x: left, y, size: 8, font: body, color: MUTED }
    );

    return Buffer.from(await pdf.save());
  }
}
