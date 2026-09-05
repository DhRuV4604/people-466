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

const BRAND = rgb(0.427, 0.157, 0.851);
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.88, 0.89, 0.91);

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

    const margin = 56;
    const inner = width - margin * 2;

    // A band across the top rather than a heading floating on white: this page
    // was added by the system, and it should not be mistakable for another
    // page of the document a person actually agreed to.
    page.drawRectangle({
      x: 0,
      y: height - 84,
      width,
      height: 84,
      color: BRAND,
    });
    page.drawText('Certificate of signature', {
      x: margin,
      y: height - 46,
      size: 17,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText(evidence.documentTitle.slice(0, 78), {
      x: margin,
      y: height - 66,
      size: 9.5,
      font: body,
      color: rgb(0.89, 0.85, 0.98),
    });

    let y = height - 84 - 44;

    // ---- The mark itself, in a box that reads as a signature block.
    const boxHeight = 96;
    page.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: inner,
      height: boxHeight,
      borderColor: LINE,
      borderWidth: 1,
      color: rgb(0.985, 0.985, 0.99),
    });

    page.drawText('SIGNED BY', {
      x: margin + 16,
      y: y - 22,
      size: 7.5,
      font: bold,
      color: MUTED,
    });
    page.drawText(evidence.signerName, {
      x: margin + 16,
      y: y - 40,
      size: 14,
      font: bold,
      color: INK,
    });
    page.drawText(evidence.signerEmail, {
      x: margin + 16,
      y: y - 56,
      size: 9,
      font: body,
      color: MUTED,
    });

    const png = evidence.signatureImage.split(',')[1];
    if (png) {
      const image = await pdf.embedPng(Buffer.from(png, 'base64')).catch(() => null);
      if (image) {
        // Scaled to a fixed height so a wide scrawl and a short one sit the
        // same on the page, and right-aligned inside the box so the name and
        // the mark read as one signature block.
        const drawn = image.scaleToFit(190, 52);
        page.drawImage(image, {
          x: margin + inner - drawn.width - 24,
          y: y - boxHeight + 30,
          width: drawn.width,
          height: drawn.height,
        });
        page.drawLine({
          start: { x: margin + inner - 214, y: y - boxHeight + 24 },
          end: { x: margin + inner - 24, y: y - boxHeight + 24 },
          thickness: 1,
          color: LINE,
        });
      }
    }

    y -= boxHeight + 34;

    // ---- What was recorded, in two columns so the page is not a long list.
    const half = inner / 2;
    const fact = (x: number, top: number, label: string, value: string) => {
      page.drawText(label.toUpperCase(), { x, y: top, size: 7.5, font: bold, color: MUTED });
      page.drawText(value || 'not recorded', {
        x,
        y: top - 14,
        size: 9.5,
        font: body,
        color: INK,
      });
    };

    fact(margin, y, 'Signed at', formatStamp(evidence.signedAt));
    fact(margin + half, y, 'IP address', evidence.ip);
    fact(margin, y - 40, 'Device', evidence.userAgent.slice(0, 46));
    fact(margin + half, y - 40, 'Method', 'Whole-document acceptance');

    y -= 84;

    // ---- The fingerprint, given its own block because it is the evidence.
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + inner, y },
      thickness: 1,
      color: LINE,
    });
    y -= 22;

    page.drawText('DOCUMENT FINGERPRINT (SHA-256)', {
      x: margin,
      y,
      size: 7.5,
      font: bold,
      color: MUTED,
    });
    // Split across two lines: 64 characters do not fit the page at a legible
    // size, and a truncated fingerprint proves nothing.
    page.drawText(evidence.documentChecksum.slice(0, 32), {
      x: margin,
      y: y - 16,
      size: 9.5,
      font: mono,
      color: INK,
    });
    page.drawText(evidence.documentChecksum.slice(32), {
      x: margin,
      y: y - 30,
      size: 9.5,
      font: mono,
      color: INK,
    });

    y -= 58;
    page.drawText(
      'This page was added when the document was signed. The fingerprint above is of the',
      { x: margin, y, size: 8, font: body, color: MUTED }
    );
    page.drawText(
      'document as it was sent; the pages before this one are unchanged.',
      { x: margin, y: y - 11, size: 8, font: body, color: MUTED }
    );

    return Buffer.from(await pdf.save());
  }
}
