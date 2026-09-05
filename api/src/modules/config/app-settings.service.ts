import { Injectable } from '@nestjs/common';
import { DEFAULT_APP_SETTINGS, type AppSettingsDto } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAppSettingsDto } from './dto/config.dto';

/**
 * Organisation-wide policy, held as one pinned row.
 *
 * Every read goes through here rather than touching the table directly, so an
 * install that has never opened the settings screen still behaves like the
 * documented defaults instead of failing on a missing row.
 */
const SINGLETON_ID = 'singleton';

@Injectable()
export class AppSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AppSettingsDto> {
    const row = await this.prisma.appSettings.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) return { ...DEFAULT_APP_SETTINGS };

    return {
      maxCheckInsPerDay: row.maxCheckInsPerDay,
      warnOnCheckOut: row.warnOnCheckOut,
    };
  }

  /**
   * Merges onto whatever is stored, creating the row on the first save. An
   * omitted field is left as it is rather than reset, so a caller changing one
   * setting cannot silently revert another.
   */
  async update(dto: UpdateAppSettingsDto): Promise<AppSettingsDto> {
    const patch = {
      ...(dto.maxCheckInsPerDay !== undefined
        ? { maxCheckInsPerDay: dto.maxCheckInsPerDay }
        : {}),
      ...(dto.warnOnCheckOut !== undefined ? { warnOnCheckOut: dto.warnOnCheckOut } : {}),
    };

    const row = await this.prisma.appSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...DEFAULT_APP_SETTINGS, ...patch },
      update: patch,
    });

    return {
      maxCheckInsPerDay: row.maxCheckInsPerDay,
      warnOnCheckOut: row.warnOnCheckOut,
    };
  }
}
