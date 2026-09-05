import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditChange, AuditLogDto, Role, Paginated } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { pageArgs, paginated } from '../../common/pagination';
import { QueryAuditLogsDto } from './dto/audit-log.dto';
import { AUDITED_MODELS, delegateFor, type AuditRow } from './audit.entities';
import type { AuditActor, AuditEntry } from './audit-context';

export interface RecordAuditInput extends AuditEntry {
  actor: AuditActor;
  method: string;
  path: string;
  ip: string | null;
}

type FinderDelegate = { findFirst(args: unknown): Promise<AuditRow | null> } | undefined;

/**
 * Reads the trail, and is the only thing that writes it.
 *
 * There is no write endpoint and there never should be: a trail anyone can add
 * to is not evidence of anything.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Losing a log line is bad; losing the user's work because a log line could
   * not be written is worse. Every failure here stops at this method.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          // Denormalised alongside the relation so the row still says who acted
          // once the account is gone and userId has been nulled out.
          userId: input.actor.userId,
          userName: input.actor.userName,
          userRole: input.actor.userRole,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          entityLabel: input.entityLabel,
          ...(input.changes && input.changes.length > 0
            ? { changes: input.changes as unknown as Prisma.InputJsonValue }
            : {}),
          ...(input.snapshot ? { snapshot: input.snapshot as Prisma.InputJsonValue } : {}),
          method: input.method,
          path: input.path,
          ip: input.ip,
        },
      });
    } catch (error) {
      this.logger.error(
        `Audit row not written for ${input.action} ${input.entity}: ${(error as Error).message}`
      );
    }
  }

  async findAll(query: QueryAuditLogsDto): Promise<Paginated<AuditLogDto>> {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? endOfDay(query.to) : null;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { userName: { contains: query.q, mode: 'insensitive' as const } },
              { entityLabel: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const { skip, take, page, pageSize } = pageArgs(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
      where,
      // Newest first; the id breaks ties within the same millisecond so paging
      // never shows the same row twice.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      userRole: row.userRole as Role,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      changes: toChanges(row.changes),
      method: row.method,
      path: row.path,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    }));

    return paginated(items, total, page, pageSize);
  }

  /**
   * Names a record the query hook never got to see - the verb routes whose whole
   * effect lands in rows the trail does not follow, such as sending payslips.
   */
  async labelFor(model: string, id: string | null): Promise<string | null> {
    const spec = AUDITED_MODELS[model];
    if (!spec || !id) return null;

    try {
      const delegates = this.prisma as unknown as Record<string, FinderDelegate>;
      const row = await delegates[delegateFor(model)]?.findFirst({
        where: { id },
        ...(spec.include ? { include: spec.include } : {}),
      });
      return row ? spec.label(row) : null;
    } catch {
      return null;
    }
  }
}

function endOfDay(value: string): Date {
  // A date-only bound means the whole day, matching the other list endpoints.
  return value.includes('T') ? new Date(value) : new Date(`${value}T23:59:59.999`);
}

/**
 * Stored as AuditChange[]. An object map of the same information is accepted
 * too, so a row written by hand or by an older shape still reads back.
 */
function toChanges(value: Prisma.JsonValue | null): AuditChange[] {
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    // Prisma types a JSON array element as JsonValue, which a type predicate
    // cannot narrow to an object shape; reading each entry through an unknown
    // cast keeps the runtime check and drops the impossible predicate.
    return value.reduce<AuditChange[]>((changes, item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return changes;
      const shaped = item as unknown as Record<string, unknown>;
      if (typeof shaped.field !== 'string') return changes;
      changes.push({ field: shaped.field, from: shaped.from ?? null, to: shaped.to ?? null });
      return changes;
    }, []);
  }

  return Object.entries(value as Record<string, unknown>).map(([field, change]) => {
    const shaped = (change ?? {}) as Record<string, unknown>;
    return { field, from: shaped.from ?? null, to: shaped.to ?? null };
  });
}
