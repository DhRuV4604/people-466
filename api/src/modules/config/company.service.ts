import { BadRequestException, Injectable } from '@nestjs/common';
import { DEFAULT_COMPANY, type CompanyDto } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService, type UploadedFile } from '../files/storage.service';
import type { UpdateCompanyDto } from './dto/company.dto';

const SINGLETON_ID = 'singleton';

/** Logos are shown, not filed. A PDF or a Word document is not one. */
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Who this install is.
 *
 * Held on the same pinned row as the rest of the organisation's settings,
 * because it is the same kind of thing: one answer per install, read
 * everywhere. It is separated from `AppSettingsService` only by who may write
 * it and who needs to read it - a payslip needs the company name, and the
 * person reading their own payslip is not an administrator.
 */
@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  async get(): Promise<CompanyDto> {
    const row = await this.prisma.appSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    // An install that has never opened the settings screen still has a name to
    // print, rather than a blank header on every payslip.
    if (!row) return { ...DEFAULT_COMPANY };

    return {
      name: row.companyName,
      legalName: row.companyLegalName,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      country: row.country,
      email: row.companyEmail,
      phone: row.companyPhone,
      website: row.website,
      taxId: row.taxId,
      logoFileId: row.logoFileId,
    };
  }

  /**
   * Merges onto what is stored. An omitted field is left alone; a field sent
   * as an empty string is cleared, which is how a form says "remove this".
   */
  async update(dto: UpdateCompanyDto): Promise<CompanyDto> {
    const blank = (value: string | undefined) =>
      value === undefined ? undefined : value.trim() === '' ? null : value.trim();

    const patch = {
      ...(dto.name !== undefined ? { companyName: dto.name.trim() } : {}),
      ...(dto.legalName !== undefined ? { companyLegalName: blank(dto.legalName) } : {}),
      ...(dto.addressLine1 !== undefined ? { addressLine1: blank(dto.addressLine1) } : {}),
      ...(dto.addressLine2 !== undefined ? { addressLine2: blank(dto.addressLine2) } : {}),
      ...(dto.city !== undefined ? { city: blank(dto.city) } : {}),
      ...(dto.state !== undefined ? { state: blank(dto.state) } : {}),
      ...(dto.postalCode !== undefined ? { postalCode: blank(dto.postalCode) } : {}),
      ...(dto.country !== undefined ? { country: blank(dto.country) } : {}),
      ...(dto.email !== undefined ? { companyEmail: blank(dto.email) } : {}),
      ...(dto.phone !== undefined ? { companyPhone: blank(dto.phone) } : {}),
      ...(dto.website !== undefined ? { website: blank(dto.website) } : {}),
      ...(dto.taxId !== undefined ? { taxId: blank(dto.taxId) } : {}),
    };

    await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...patch },
      update: patch,
    });

    return this.get();
  }

  async setLogo(file: UploadedFile | undefined, userId: string): Promise<CompanyDto> {
    if (!file) throw new BadRequestException('Choose an image to use as the logo.');
    if (!LOGO_TYPES.has(file.mimetype)) {
      throw new BadRequestException('The logo has to be a PNG, JPEG or WebP image.');
    }

    const stored = await this.storage.save(file, userId, 'branding');
    await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, logoFileId: stored.id },
      update: { logoFileId: stored.id },
    });

    // The previous logo's row and bytes are left alone. A payslip generated
    // last month referred to it, and reprinting one should not produce a
    // document with a hole where the letterhead was.
    return this.get();
  }

  async removeLogo(): Promise<CompanyDto> {
    await this.prisma.appSettings.update({
      where: { id: SINGLETON_ID },
      data: { logoFileId: null },
    });
    return this.get();
  }

  /** The logo bytes, for stamping into a PDF. Null when there is none. */
  async logoBuffer(): Promise<Buffer | null> {
    const row = await this.prisma.appSettings.findUnique({
      where: { id: SINGLETON_ID },
      select: { logoFileId: true },
    });
    if (!row?.logoFileId) return null;
    return this.storage.buffer(row.logoFileId).catch(() => null);
  }
}
