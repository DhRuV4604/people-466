import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuditAction, AuditChange, Role } from '@peoplepay360/shared';

/**
 * The request-scoped store where the two halves of the trail meet.
 *
 * They cannot be one half. The Prisma client extension is the only layer that
 * still has the row as it was before a write, so it is the only place a real
 * field-level diff can be computed - but it sees queries, not requests, and so
 * cannot say who made the change, over which route, from which address. The
 * interceptor knows exactly that and nothing about the rows underneath: by the
 * time a response exists the previous values are gone. Neither can be folded
 * into the other, so AsyncLocalStorage carries the request down to the query
 * hook and carries what the hook saw back up again.
 */

export interface AuditActor {
  /** Null only when the account has since been deleted; see AuditLog.userId. */
  userId: string | null;
  userName: string;
  userRole: Role;
}

/** What the route says the request is about, before any row is touched. */
export interface AuditIntent {
  /** Prisma model name the path names, e.g. "LeaveRequest". */
  model: string | null;
  entityId: string | null;
  /** Set only where the HTTP verb is not enough: .../approve, .../mark-paid. */
  action: AuditAction | null;
}

/** What the query hook saw, waiting to be written once the request settles. */
export interface AuditEntry {
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  action: AuditAction;
  changes: AuditChange[] | null;
  snapshot: Record<string, unknown> | null;
}

export interface AuditRequestContext {
  actor: AuditActor | null;
  method: string;
  path: string;
  ip: string | null;
  intent: AuditIntent;
  /** The record this request is about, once the hook has described it. */
  entry: AuditEntry | null;
  /**
   * Set once the primary record is described, so a route that then writes a
   * dozen child rows still produces one line in the trail rather than a dozen.
   */
  captured: boolean;
  /**
   * Any write at all, on any model. A verb route whose whole effect lands in
   * rows the trail does not follow one by one - send-payslips only writes email
   * logs - still has to leave a line, and a request that turned out to write
   * nothing must not.
   */
  touched: boolean;
  /** First model written, so an unrecognised route can still name its subject. */
  touchedModel: string | null;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

export function runWithAuditContext<T>(context: AuditRequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentAuditContext(): AuditRequestContext | undefined {
  return storage.getStore();
}
