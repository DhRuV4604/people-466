import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';

/** What may be uploaded, and what it is allowed to be called on the way out. */
const ALLOWED: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

/** 20 MB. Large enough for a scanned contract, small enough to refuse a video. */
const MAX_BYTES = 20 * 1024 * 1024;

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Files on disk, described in the database.
 *
 * The two are deliberately not symmetrical: the row is the record and the file
 * is just bytes it points at. A key is generated rather than taken from the
 * upload, because a filename is client input and `../` in one is how a writable
 * directory becomes the whole filesystem.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    this.root = resolve(config.get<string>('storage.root') ?? './storage');
  }

  /** Absolute path for a stored key, refusing anything that leaves the root. */
  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new BadRequestException('Invalid file reference.');
    }
    return full;
  }

  private validate(file: UploadedFile): string {
    const extension = ALLOWED[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        `${file.mimetype} is not a file type this accepts. Use a PDF, an image, or a Word document.`
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('That file is larger than 20 MB.');
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('That file is empty.');
    }
    return extension;
  }

  /**
   * Writes the bytes and records them.
   *
   * Grouped by year and month so one directory does not end up holding every
   * file the system has ever seen.
   */
  async save(
    file: UploadedFile,
    uploadedById: string,
    folder = 'documents'
  ): Promise<{ id: string; key: string; checksum: string }> {
    const extension = this.validate(file);
    const now = new Date();
    const key = join(
      folder,
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}${extension}`
    ).split(sep).join('/');

    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.buffer);

    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    const record = await this.prisma.storedFile.create({
      data: {
        key,
        // Kept for display and for the download name only. It is never joined
        // to a path.
        filename: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        size: file.size,
        checksum,
        uploadedById,
      },
      select: { id: true, key: true, checksum: true },
    });

    return record;
  }

  /** Stores bytes this service produced itself, such as a stamped PDF. */
  async saveGenerated(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    uploadedById: string,
    folder = 'documents'
  ): Promise<{ id: string; key: string; checksum: string }> {
    return this.save(
      { originalname: filename, mimetype: mimeType, size: buffer.length, buffer },
      uploadedById,
      folder
    );
  }

  async read(fileId: string): Promise<{ stream: ReadStream; filename: string; mimeType: string; size: number }> {
    const file = await this.prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found.');

    return {
      stream: createReadStream(this.pathFor(file.key)),
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
    };
  }

  async buffer(fileId: string): Promise<Buffer> {
    const file = await this.prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } });
    const { readFile } = await import('node:fs/promises');
    return readFile(this.pathFor(file.key));
  }

  /**
   * Removes the bytes. The row stays: something signed may still refer to it,
   * and a dangling reference is easier to explain than a missing one.
   */
  async discard(key: string): Promise<void> {
    await unlink(this.pathFor(key)).catch((error) => {
      this.logger.warn(`Could not remove ${key}: ${error.message}`);
    });
  }
}
