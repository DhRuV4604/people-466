import { Prisma } from '@prisma/client';
import type { AuditChange } from '@peoplepay360/shared';
import type { AuditRow, ModelSpec } from './audit.entities';

/**
 * Turning two rows into something a person can read.
 *
 * A diff is only worth having if every line in it is a decision someone made,
 * so timestamps the database maintains and columns the service recomputes are
 * dropped, and secrets never reach the row at all.
 */

/**
 * Never stored. A password hash in an audit log is a password hash on loan, and
 * a bank account number is the same borrowed thing: the trail has to say that
 * the details changed, or that a leaver's record held some, and has no business
 * keeping its own copy of them after the record they belonged to is gone.
 */
const SECRET = /password|secret|token|bankAccount/i;
export const REDACTED = '[redacted]';

/** Maintained by the database, not chosen by anyone. */
const ALWAYS_IGNORED = ['id', 'createdAt', 'updatedAt'] as const;

/** Decimal and Date survive JSON as objects, so both are flattened first. */
function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/**
 * Relations pulled in to name the record are not columns, and comparing them
 * would report an employee's whole row as having changed.
 */
function isColumn(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value instanceof Prisma.Decimal || value instanceof Date) return true;
  if (Array.isArray(value)) return value.every((item) => typeof item !== 'object' || item === null);
  return typeof value !== 'object';
}

const stable = (value: unknown): string => JSON.stringify(normalise(value) ?? null);

export function ignoredFields(spec: ModelSpec): Set<string> {
  return new Set<string>([
    ...ALWAYS_IGNORED,
    ...(spec.derived ?? []),
    ...Object.keys(spec.include ?? {}),
  ]);
}

/**
 * Only the fields that actually differ. Walks the record as it is now rather
 * than the union of both, so a partially selected write still yields a diff of
 * exactly what it wrote instead of inventing changes for columns it never read.
 */
export function diffRecords(
  before: AuditRow | null,
  after: AuditRow | null,
  ignored: ReadonlySet<string>
): AuditChange[] {
  if (!before || !after) return [];

  const changes: AuditChange[] = [];
  for (const [field, value] of Object.entries(after)) {
    if (ignored.has(field) || !(field in before)) continue;
    if (!isColumn(value) || !isColumn(before[field])) continue;
    if (stable(before[field]) === stable(value)) continue;

    changes.push(
      SECRET.test(field)
        ? { field, from: REDACTED, to: REDACTED }
        : { field, from: normalise(before[field]), to: normalise(value) }
    );
  }
  return changes;
}

/**
 * The record as it was, for a delete. Ids and timestamps are kept here - unlike
 * in a diff - because nothing else can describe the row once it is gone.
 */
export function snapshotOf(row: AuditRow, relations: ReadonlySet<string>): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(row)) {
    if (relations.has(field) || !isColumn(value)) continue;
    snapshot[field] = SECRET.test(field) ? REDACTED : normalise(value);
  }
  return snapshot;
}
