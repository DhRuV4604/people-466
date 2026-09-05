import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  DocumentDto,
  DocumentSignatureDto,
  Paginated,
} from '@peoplepay360/shared';
import { scopeToOwnRecords } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { pageArgs, paginated } from '../../common/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService, type UploadedFile } from '../files/storage.service';
import { SigningService } from '../files/signing.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type {
  CreateDocumentDto,
  DeclineDocumentDto,
  QueryDocumentsDto,
  RequestDocumentDto,
  SignDocumentDto,
} from './dto/document.dto';

const INCLUDE = {
  employee: {
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  },
  file: { select: { id: true, filename: true, mimeType: true, size: true } },
  signedFile: { select: { id: true, filename: true, mimeType: true, size: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.DocumentInclude;

type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof INCLUDE }>;

/** Statuses the employee is meant to see. A draft is not one of them. */
const VISIBLE_TO_EMPLOYEE = [
  'REQUESTED',
  'AWAITING_SIGNATURE',
  'SUBMITTED',
  'SIGNED',
  'DECLINED',
] as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly signing: SigningService,
    private readonly notifications: NotificationsService
  ) {}

  private toDto(row: DocumentRow): DocumentDto {
    return {
      id: row.id,
      title: row.title,
      kind: row.kind,
      status: row.status,
      message: row.message,
      requiresSignature: row.requiresSignature,
      employeeId: row.employeeId,
      employee: {
        id: row.employee.id,
        fullName: `${row.employee.firstName} ${row.employee.lastName}`,
        employeeCode: row.employee.employeeCode,
      },
      file: row.file,
      signedFile: row.signedFile,
      createdBy: row.createdBy,
      sentAt: row.sentAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      signedAt: row.signedAt?.toISOString() ?? null,
      declinedAt: row.declinedAt?.toISOString() ?? null,
      declineReason: row.declineReason,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Narrows a list to what this person may see.
   *
   * An employee sees their own file, minus anything still being prepared.
   * Applied in the query rather than after it, so a page of results never
   * holds a row the browser is then trusted to hide.
   */
  private scope(user: AuthenticatedUser): Prisma.DocumentWhereInput | undefined {
    if (!scopeToOwnRecords(user.role)) return undefined;
    if (!user.employeeId) {
      throw new ForbiddenException('This account has no employee record.');
    }
    return {
      employeeId: user.employeeId,
      status: { in: [...VISIBLE_TO_EMPLOYEE] },
    };
  }

  async findAll(
    query: QueryDocumentsDto,
    user: AuthenticatedUser
  ): Promise<Paginated<DocumentDto>> {
    const { skip, take, page, pageSize } = pageArgs(query);

    const where: Prisma.DocumentWhereInput = {
      ...this.scope(user),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              {
                employee: {
                  firstName: { contains: query.q, mode: 'insensitive' as const },
                },
              },
              {
                employee: {
                  lastName: { contains: query.q, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.document.count({ where }),
    ]);

    return paginated(
      rows.map((row) => this.toDto(row)),
      total,
      page,
      pageSize
    );
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<DocumentDto> {
    const row = await this.prisma.document.findFirst({
      where: { id, ...this.scope(user) },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Document not found.');
    return this.toDto(row);
  }

  /** The signature evidence, for whoever is allowed to see the document. */
  async signature(
    id: string,
    user: AuthenticatedUser
  ): Promise<DocumentSignatureDto> {
    const row = await this.prisma.document.findFirst({
      where: { id, ...this.scope(user) },
      select: {
        signerName: true,
        signerEmail: true,
        signerIp: true,
        signerUserAgent: true,
        signedChecksum: true,
        signedAt: true,
      },
    });
    if (!row) throw new NotFoundException('Document not found.');
    return { ...row, signedAt: row.signedAt?.toISOString() ?? null };
  }

  async create(
    dto: CreateDocumentDto,
    file: UploadedFile | undefined,
    user: AuthenticatedUser
  ): Promise<DocumentDto> {
    if (!file) throw new BadRequestException('Attach the document to send.');

    // A whole-document signature is a certificate page appended to a PDF.
    // Nothing else can carry one, so it is refused now rather than at the
    // point of signing, when the employee is already waiting on it.
    if (dto.requiresSignature && file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        'Only a PDF can be sent for signature. Convert the document and try again.'
      );
    }

    await this.employeeOrThrow(dto.employeeId);

    const stored = await this.storage.save(file, user.userId);
    const send = dto.send ?? true;

    const row = await this.prisma.document.create({
      data: {
        title: dto.title,
        kind: dto.kind,
        message: dto.message ?? null,
        requiresSignature: dto.requiresSignature ?? false,
        employeeId: dto.employeeId,
        fileId: stored.id,
        createdById: user.userId,
        status: send
          ? dto.requiresSignature
            ? 'AWAITING_SIGNATURE'
            : 'SUBMITTED'
          : 'DRAFT',
        sentAt: send ? new Date() : null,
      },
      include: INCLUDE,
    });

    if (send) await this.tellEmployee(row, user);
    return this.toDto(row);
  }

  /** Asks the employee for a file. Nothing is attached until they answer. */
  async request(
    dto: RequestDocumentDto,
    user: AuthenticatedUser
  ): Promise<DocumentDto> {
    await this.employeeOrThrow(dto.employeeId);

    const row = await this.prisma.document.create({
      data: {
        title: dto.title,
        kind: dto.kind,
        message: dto.message ?? null,
        employeeId: dto.employeeId,
        createdById: user.userId,
        status: 'REQUESTED',
        sentAt: new Date(),
      },
      include: INCLUDE,
    });

    await this.tellEmployee(row, user);
    return this.toDto(row);
  }

  /**
   * The employee answering a request with the file that was asked for.
   *
   * Guarded on the record rather than by permission: what makes this allowed
   * is that the request was addressed to them.
   */
  async submit(
    id: string,
    file: UploadedFile | undefined,
    user: AuthenticatedUser
  ): Promise<DocumentDto> {
    if (!file) throw new BadRequestException('Attach the file you were asked for.');

    const existing = await this.prisma.document.findUnique({
      where: { id },
      select: { employeeId: true, status: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Document not found.');
    if (existing.employeeId !== user.employeeId) {
      throw new ForbiddenException('That request was not addressed to you.');
    }
    if (existing.status !== 'REQUESTED') {
      throw new BadRequestException('That document is not waiting on a file.');
    }

    const stored = await this.storage.save(file, user.userId);
    const row = await this.prisma.document.update({
      where: { id },
      data: { fileId: stored.id, status: 'SUBMITTED', submittedAt: new Date() },
      include: INCLUDE,
    });

    await this.notifications.notify([existing.createdById], {
      type: 'document.submitted',
      title: `${row.employee.firstName} ${row.employee.lastName} sent ${row.title}`,
      body: 'The document you asked for has arrived.',
      href: `/documents/${row.id}`,
      actorName: user.name,
      actorId: user.userId,
    });

    return this.toDto(row);
  }

  /**
   * Signing.
   *
   * The original file is never modified: the certificate goes on a new page of
   * a new file, and both are kept. The checksum on that page refers to the
   * document as it was sent, so what was agreed to stays provable.
   */
  async sign(
    id: string,
    dto: SignDocumentDto,
    user: AuthenticatedUser,
    context: { ip: string; userAgent: string }
  ): Promise<DocumentDto> {
    const existing = await this.prisma.document.findUnique({
      where: { id },
      include: {
        file: true,
        employee: {
          select: { firstName: true, lastName: true, workEmail: true },
        },
      },
    });
    if (!existing) throw new NotFoundException('Document not found.');

    if (existing.employeeId !== user.employeeId) {
      throw new ForbiddenException('This document was sent to someone else.');
    }
    if (existing.status !== 'AWAITING_SIGNATURE') {
      throw new BadRequestException(
        existing.status === 'SIGNED'
          ? 'This has already been signed.'
          : 'This document is not waiting for a signature.'
      );
    }
    if (!existing.file) {
      throw new BadRequestException('This document has no file to sign.');
    }
    if (!dto.signatureImage.startsWith('data:image/png;base64,')) {
      throw new BadRequestException('The signature must be a PNG image.');
    }

    const signerName = `${existing.employee.firstName} ${existing.employee.lastName}`;

    // Typing your own name is the intent check. Compared loosely because
    // people write "R. Mehta", and a signature refused over punctuation helps
    // nobody.
    const normalise = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');
    if (!normalise(signerName).includes(normalise(dto.typedName).slice(0, 40))) {
      throw new BadRequestException(
        `Type your name as it appears on the document: ${signerName}.`
      );
    }

    const original = await this.storage.buffer(existing.file.id);
    const signedAt = new Date();

    const certified = await this.signing.certify(original, {
      signerName,
      signerEmail: existing.employee.workEmail,
      signedAt,
      ip: context.ip,
      userAgent: context.userAgent,
      documentChecksum: existing.file.checksum,
      documentTitle: existing.title,
      signatureImage: dto.signatureImage,
    });

    const safeTitle = existing.title.replace(/[^\w\s-]/g, '').trim() || 'document';
    const stored = await this.storage.saveGenerated(
      certified,
      `${safeTitle} (signed).pdf`,
      'application/pdf',
      user.userId,
      'signed'
    );

    const row = await this.prisma.document.update({
      where: { id },
      data: {
        status: 'SIGNED',
        signedFileId: stored.id,
        signedAt,
        signerName,
        signerEmail: existing.employee.workEmail,
        signerIp: context.ip,
        signerUserAgent: context.userAgent.slice(0, 500),
        signedChecksum: existing.file.checksum,
        signatureImage: dto.signatureImage,
      },
      include: INCLUDE,
    });

    await this.notifications.notify([existing.createdById], {
      type: 'document.signed',
      title: `${signerName} signed ${row.title}`,
      body: 'The signed copy is on the document.',
      href: `/documents/${row.id}`,
      actorName: user.name,
      actorId: user.userId,
    });

    return this.toDto(row);
  }

  async decline(
    id: string,
    dto: DeclineDocumentDto,
    user: AuthenticatedUser
  ): Promise<DocumentDto> {
    const existing = await this.prisma.document.findUnique({
      where: { id },
      select: { employeeId: true, status: true, createdById: true },
    });
    if (!existing) throw new NotFoundException('Document not found.');
    if (existing.employeeId !== user.employeeId) {
      throw new ForbiddenException('This document was sent to someone else.');
    }
    if (existing.status !== 'AWAITING_SIGNATURE') {
      throw new BadRequestException('This document is not waiting for a signature.');
    }

    const row = await this.prisma.document.update({
      where: { id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        declineReason: dto.reason,
      },
      include: INCLUDE,
    });

    await this.notifications.notify([existing.createdById], {
      type: 'document.declined',
      title: `${row.employee.firstName} ${row.employee.lastName} declined ${row.title}`,
      body: dto.reason,
      href: `/documents/${row.id}`,
      actorName: user.name,
      actorId: user.userId,
    });

    return this.toDto(row);
  }

  /** Sends a draft. Separate from create, so one can be prepared and checked. */
  async send(id: string, user: AuthenticatedUser): Promise<DocumentDto> {
    const existing = await this.prisma.document.findUnique({
      where: { id },
      select: { status: true, requiresSignature: true, fileId: true },
    });
    if (!existing) throw new NotFoundException('Document not found.');
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only a draft can be sent.');
    }
    if (!existing.fileId) throw new BadRequestException('This draft has no file.');

    const row = await this.prisma.document.update({
      where: { id },
      data: {
        status: existing.requiresSignature ? 'AWAITING_SIGNATURE' : 'SUBMITTED',
        sentAt: new Date(),
      },
      include: INCLUDE,
    });

    await this.tellEmployee(row, user);
    return this.toDto(row);
  }

  /**
   * Withdraws it. Never deleted: a document someone was asked to sign is part
   * of the record whether or not it went anywhere.
   */
  async cancel(id: string, _user: AuthenticatedUser): Promise<DocumentDto> {
    const existing = await this.prisma.document.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Document not found.');
    if (existing.status === 'SIGNED') {
      throw new BadRequestException('A signed document cannot be withdrawn.');
    }

    const row = await this.prisma.document.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: INCLUDE,
    });
    return this.toDto(row);
  }

  /**
   * Which file a request for this document should serve, and whether this
   * person may have it.
   *
   * The signed copy wins where there is one: it is the version that carries
   * the certificate, and the one anybody asking for "the document" means.
   */
  async fileFor(
    id: string,
    user: AuthenticatedUser,
    which: 'original' | 'signed'
  ): Promise<string> {
    const row = await this.prisma.document.findFirst({
      where: { id, ...this.scope(user) },
      select: { fileId: true, signedFileId: true },
    });
    if (!row) throw new NotFoundException('Document not found.');

    const fileId = which === 'signed' ? row.signedFileId : row.fileId;
    if (!fileId) throw new NotFoundException('There is no file on this document.');
    return fileId;
  }

  private async employeeOrThrow(id: string): Promise<void> {
    const exists = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Employee not found.');
  }

  private async tellEmployee(
    row: DocumentRow,
    actor: AuthenticatedUser
  ): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: row.employeeId },
      select: { userId: true },
    });
    if (!employee) return;

    const asks = row.status === 'REQUESTED';
    await this.notifications.notify([employee.userId], {
      type: asks ? 'document.requested' : 'document.received',
      title: asks ? `${row.title} was requested` : row.title,
      body: asks
        ? 'Upload it from your documents.'
        : row.requiresSignature
          ? 'Waiting for your signature.'
          : 'Added to your documents.',
      href: '/me/documents',
      actorName: actor.name,
      actorId: actor.userId,
    });
  }
}
