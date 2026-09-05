import { Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/notification.dto';
import { CurrentUser } from '../../common/decorators';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';
import type { AuthenticatedUser } from '../auth/auth.types';

/** Short enough to beat the ~30s idle timeout of a default proxy. */
const HEARTBEAT_MS = 25_000;

/**
 * Every route here is self-scoped: a user reads and marks their own rows and
 * nobody else's, whatever id the URL carries. There is no notifications module
 * in the RBAC matrix because there is nothing to grant - having an account is
 * the permission - so these are guarded by identity, not by @RequirePermission.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Own notifications, newest first' })
  findAll(@Query() query: QueryNotificationsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.userId, query);
  }

  /**
   * Server-sent events rather than a WebSocket: this traffic only ever goes one
   * way, it rides an ordinary HTTP response so proxies pass it through, and the
   * browser reconnects on its own when it drops.
   *
   * EventSource cannot set an Authorization header, so the web client proxies
   * this route through its own server and attaches the session cookie there.
   */
  @Get('stream')
  @ApiOperation({ summary: 'Live notification stream (text/event-stream)' })
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response
  ): void {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform also asks intermediaries not to compress, which is the
      // other common way a stream ends up buffered instead of flushed.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();

    const send = (event: string, data: unknown): void => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Tells the client the stream is open rather than merely pending.
    send('ready', { at: new Date().toISOString() });

    const unsubscribe = this.notifications.subscribe(user.userId, (n) => send('notification', n));

    // A comment line: it keeps the connection warm without the client seeing an
    // event, because an idle proxy closes a response that says nothing.
    const heartbeat = setInterval(() => response.write(': ping\n\n'), HEARTBEAT_MS);

    // Without this, every reconnect would leave a listener and a timer behind.
    const close = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    request.on('close', close);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification read; returns the fresh summary' })
  markRead(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.notifications.markRead(user.userId, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark every unread notification read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }
}
