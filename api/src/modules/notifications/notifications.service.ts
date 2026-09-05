import { EventEmitter } from 'node:events';
import { Injectable, Logger } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import {
  ROLES,
  can,
  type Action,
  type Module as PermissionModule,
  type NotificationDto,
  type NotificationSummaryDto,
  type Role,
} from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryNotificationsDto } from './dto/notification.dto';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** What an event that concerns somebody else looks like on the wire. */
export interface NotifyPayload {
  /** Dotted event name, e.g. "leave.filed". The client maps it to an icon. */
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  actorName?: string | null;
  /**
   * Whoever caused the event. Dropped from the fan-out: being told about your
   * own action is noise, and it is the one recipient guaranteed to know already.
   */
  actorId?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Delivery bus for the SSE stream, one event name per recipient.
   *
   * In-process, so an event only reaches the clients connected to this API
   * instance. Behind more than one instance a subscriber on the other one sees
   * nothing until it refetches; carrying the fan-out over Redis pub/sub or
   * Postgres LISTEN/NOTIFY (already in the stack) is what would fix that.
   */
  private readonly bus = new EventEmitter();

  constructor(private readonly prisma: PrismaService) {
    // One listener per open stream, and a popular account may have several tabs
    // open, so the default ceiling of ten would log a spurious leak warning.
    this.bus.setMaxListeners(0);
  }

  // ---------------------------------------------------------------- Raising

  /** Writes one row per recipient and pushes each to that recipient's stream. */
  async notify(userIds: string[], payload: NotifyPayload): Promise<number> {
    const recipients = [...new Set(userIds)].filter((id) => id && id !== payload.actorId);
    if (recipients.length === 0) return 0;

    const rows = await this.attempt(payload.type, () =>
      this.prisma.notification.createManyAndReturn({
        data: recipients.map((userId) => ({
          userId,
          type: payload.type,
          title: payload.title,
          body: payload.body ?? null,
          href: payload.href ?? null,
          actorName: payload.actorName ?? null,
        })),
      })
    );
    if (!rows) return 0;

    // Pushed outside the guard above: the rows are committed either way, and one
    // subscriber throwing on its way out must not stop the rest being told.
    for (const row of rows) {
      try {
        this.bus.emit(channelFor(row.userId), toDto(row));
      } catch (error) {
        this.warn(payload.type, error);
      }
    }
    return rows.length;
  }

  /** Fans out to every active account holding one of these roles. */
  async notifyRole(roles: Role[], payload: NotifyPayload): Promise<number> {
    if (roles.length === 0) return 0;

    const users = await this.attempt(payload.type, () =>
      this.prisma.user.findMany({
        where: { active: true, role: { in: roles } },
        select: { id: true },
      })
    );
    if (!users) return 0;

    return this.notify(
      users.map((u) => u.id),
      payload
    );
  }

  /**
   * The roles the matrix grants `module:action`, asked rather than assumed: the
   * matrix is the authority and it will change, so a hardcoded role list here
   * would silently drift out of step with it.
   */
  rolesWith(
    module: PermissionModule,
    action: Action,
    also?: (role: Role) => boolean
  ): Role[] {
    return ROLES.filter((role) => can(role, module, action) && (also?.(role) ?? true));
  }

  /** Fans out to whoever the matrix says may do `module:action`. */
  notifyPermission(
    module: PermissionModule,
    action: Action,
    payload: NotifyPayload,
    also?: (role: Role) => boolean
  ): Promise<number> {
    return this.notifyRole(this.rolesWith(module, action, also), payload);
  }

  /** Fans out to the accounts linked to these employee records, if any. */
  async notifyEmployees(employeeIds: string[], payload: NotifyPayload): Promise<number> {
    const ids = [...new Set(employeeIds)].filter(Boolean);
    if (ids.length === 0) return 0;

    // Every employee has an account, so the only question is whether it is
    // still usable: a deactivated one has nowhere to be notified.
    const employees = await this.attempt(payload.type, () =>
      this.prisma.employee.findMany({
        where: { id: { in: ids }, user: { active: true } },
        select: { userId: true },
      })
    );
    if (!employees) return 0;

    return this.notify(
      employees.map((e) => e.userId as string),
      payload
    );
  }

  /**
   * Runs one step of raising a notification. A notification is a side effect of
   * the real action, so a database that will not answer costs the notification
   * and never the leave request or pay run that raised it - which means every
   * query on this path, not only the write, has to be caught.
   */
  private async attempt<T>(type: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      this.warn(type, error);
      return null;
    }
  }

  private warn(type: string, error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Could not raise "${type}": ${reason}`);
  }

  // ---------------------------------------------------------------- Reading

  async list(userId: string, query: QueryNotificationsDto): Promise<NotificationSummaryDto> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...(query.unread ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      // Counted over every row, not the page, or the badge would cap at the limit.
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { unread, items: items.map(toDto) };
  }

  /**
   * The owner is part of the filter rather than a check before it, so a row
   * belonging to somebody else matches nothing instead of relying on a guard
   * that could be forgotten.
   */
  async markRead(userId: string, id: string): Promise<NotificationSummaryDto> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return this.list(userId, {});
  }

  async markAllRead(userId: string): Promise<NotificationSummaryDto> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return this.list(userId, {});
  }

  // ---------------------------------------------------------------- Streaming

  /** Subscribes to one user's rows; call the returned function to detach. */
  subscribe(userId: string, listener: (notification: NotificationDto) => void): () => void {
    const channel = channelFor(userId);
    this.bus.on(channel, listener);
    return () => {
      this.bus.off(channel, listener);
    };
  }
}

function channelFor(userId: string): string {
  return `user:${userId}`;
}

function toDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    actorName: n.actorName,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
