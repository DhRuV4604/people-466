import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, concatMap, from, throwError } from 'rxjs';
import type { Request } from 'express';
import type { Role } from '@peoplepay360/shared';
import { AuditService } from './audit.service';
import { AUDITED_MODELS, methodAction, routeIntent } from './audit.entities';
import { runWithAuditContext, type AuditRequestContext } from './audit-context';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * The half of the trail that can see the request.
 *
 * Who is signed in, over which method and path, from which address: none of it
 * reaches the database layer, and none of what the database layer knows reaches
 * here. This opens the request-scoped store the query hook writes into, and
 * writes the one row the request earned once it has settled.
 */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** The first thing an admin looks for, and the one row no write produces. */
const LOGIN_PATH = /\/auth\/login$/;

const isAuditedModel = (model: string | null): model is string =>
  Boolean(model && AUDITED_MODELS[model]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const method = (request.method ?? '').toUpperCase();

    // A read changes nothing, so there is nothing to record and nothing to diff.
    if (!MUTATING.has(method)) return next.handle();

    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const user = request.user;

    const store: AuditRequestContext = {
      // Guards have already run, so the account is known before the handler is.
      actor: user
        ? { userId: user.userId, userName: user.name, userRole: user.role }
        : null,
      method,
      path,
      ip: request.ip ?? request.socket?.remoteAddress ?? null,
      intent: routeIntent(path),
      entry: null,
      captured: false,
      touched: false,
      touchedModel: null,
    };

    // The handler is subscribed inside run(), so everything it awaits - down to
    // the query hook - inherits this store.
    return new Observable<unknown>((subscriber) =>
      runWithAuditContext(store, () =>
        next
          .handle()
          .pipe(
            concatMap(async (value: unknown) => {
              await this.settle(store, value, false);
              return value;
            }),
            catchError((error: unknown) =>
              from(this.settle(store, undefined, true)).pipe(
                concatMap(() => throwError(() => error))
              )
            )
          )
          .subscribe(subscriber)
      )
    );
  }

  private async settle(
    ctx: AuditRequestContext,
    value: unknown,
    failed: boolean
  ): Promise<void> {
    try {
      if (LOGIN_PATH.test(ctx.path)) {
        // A rejected sign-in has no account to attribute and no session to
        // explain, so only a successful one is recorded.
        if (!failed) await this.recordLogin(ctx, value);
        return;
      }

      const actor = ctx.actor;
      if (!actor) return;

      if (ctx.entry) {
        await this.audit.record({
          ...ctx.entry,
          // The route knows what the change meant; the hook only saw an update.
          action: ctx.intent.action ?? ctx.entry.action,
          actor,
          method: ctx.method,
          path: ctx.path,
          ip: ctx.ip,
        });
        return;
      }

      // Something was written that the hook does not follow row by row - sending
      // payslips only writes email logs - so the route itself names the subject.
      // A request that wrote nothing leaves nothing, and a failure mid-way is
      // not described because there is no telling how far it got.
      if (failed || !ctx.touched) return;

      // Falling back to the model written is what keeps a route nobody thought
      // to map from going unrecorded, but only for the domain: marking a
      // notification read is the reader's own housekeeping, not a change to the
      // business, and a trail full of it is a trail nobody reads.
      const entity = ctx.intent.model ?? (isAuditedModel(ctx.touchedModel) ? ctx.touchedModel : null);
      if (!entity) return;

      await this.audit.record({
        entity,
        entityId: ctx.intent.entityId,
        entityLabel: await this.audit.labelFor(entity, ctx.intent.entityId),
        action: ctx.intent.action ?? methodAction(ctx.method),
        changes: null,
        snapshot: null,
        actor,
        method: ctx.method,
        path: ctx.path,
        ip: ctx.ip,
      });
    } catch (error) {
      this.logger.error(`Audit trail failed for ${ctx.method} ${ctx.path}`, error as Error);
    }
  }

  /**
   * Read from the response, never the request: the body that arrived here holds
   * a password, and nothing in this file ever touches it.
   */
  private async recordLogin(ctx: AuditRequestContext, value: unknown): Promise<void> {
    const account = (value as { user?: Record<string, unknown> } | undefined)?.user;
    if (!account || typeof account.id !== 'string') return;

    const name = typeof account.name === 'string' ? account.name : account.id;

    await this.audit.record({
      actor: { userId: account.id, userName: name, userRole: account.role as Role },
      entity: 'User',
      entityId: account.id,
      entityLabel: name,
      action: 'LOGIN',
      changes: null,
      snapshot: null,
      method: ctx.method,
      path: ctx.path,
      ip: ctx.ip,
    });
  }
}
