import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { currentAuditContext, type AuditEntry, type AuditRequestContext } from './audit-context';
import {
  AUDITED_MODELS,
  delegateFor,
  observedAction,
  type AuditRow,
  type ModelSpec,
} from './audit.entities';
import { diffRecords, ignoredFields, snapshotOf } from './audit.diff';

/**
 * The half of the trail that can see the past.
 *
 * A query extension runs either side of every operation, which makes it the one
 * place that can read a row before a write lands and compare it with what the
 * write returned. Asking each service to log its own changes would leave the
 * trail exactly as complete as everyone's memory, which is to say not.
 */

const WRITES = new Set(['create', 'update', 'upsert', 'delete']);
const BULK_WRITES = new Set([
  'createMany',
  'createManyAndReturn',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

/** The unextended delegates, kept so the hook's own reads cannot re-enter it. */
type Reader = Record<string, { findFirst(args: unknown): Promise<AuditRow | null> } | undefined>;

const logger = new Logger('AuditTrail');

const isRow = (value: unknown): value is AuditRow =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const idOf = (row: AuditRow | null): string | null =>
  row && typeof row.id === 'string' ? row.id : null;

async function readRow(
  reader: Reader,
  model: string,
  where: unknown,
  include?: Record<string, unknown>
): Promise<AuditRow | null> {
  const delegate = reader[delegateFor(model)];
  if (!delegate || !where || typeof where !== 'object') return null;
  try {
    // findFirst rather than findUnique: an update's where clause is unique, but
    // it is not required to be only an id, and a failed lookup here must never
    // become a failed request.
    return await delegate.findFirst({ where, ...(include ? { include } : {}) });
  } catch (error) {
    logger.warn(`Could not read ${model} for the audit trail: ${(error as Error).message}`);
    return null;
  }
}

/** Whether this operation is the one the request is really about. */
function isPrimary(model: string, ctx: AuditRequestContext, args: unknown): boolean {
  if (ctx.captured || !AUDITED_MODELS[model]) return false;
  if (ctx.intent.model && ctx.intent.model !== model) return false;

  // A route that names a record must not have a different one logged under it.
  const where = (args as { where?: { id?: unknown } } | undefined)?.where;
  if (ctx.intent.entityId && typeof where?.id === 'string' && where.id !== ctx.intent.entityId) {
    return false;
  }
  return true;
}

async function describe(
  reader: Reader,
  model: string,
  spec: ModelSpec,
  operation: string,
  before: AuditRow | null,
  after: AuditRow | null,
  fallbackId: string | null
): Promise<AuditEntry> {
  const action = observedAction(operation, Boolean(before));
  const entityId = idOf(after) ?? idOf(before) ?? fallbackId;

  // `before` carries the relations a name needs; `after` carries the values as
  // they now are, so a record renamed by this very request reads as its new name.
  let named: AuditRow = { ...(before ?? {}), ...(after ?? {}) };
  if (!before && spec.include && entityId) {
    const enriched = await readRow(reader, model, { id: entityId }, spec.include);
    if (enriched) named = { ...enriched, ...(after ?? {}) };
  }

  const ignored = ignoredFields(spec);
  return {
    entity: model,
    entityId,
    entityLabel: spec.label(named),
    action,
    // The whole record is the change on a create, and the snapshot is the
    // record on a delete; only an update has fields that differ.
    changes: action === 'UPDATE' ? diffRecords(before, after, ignored) : null,
    snapshot:
      action === 'DELETE' && before
        ? snapshotOf(before, new Set(Object.keys(spec.include ?? {})))
        : null,
  };
}

function auditExtension(reader: Reader) {
  return Prisma.defineExtension({
    name: 'peoplepay360-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = currentAuditContext();

          // No request, no actor: seeds and start-up work are not someone's edit.
          if (!ctx) return query(args);
          if (!WRITES.has(operation)) {
            if (BULK_WRITES.has(operation) && model !== 'AuditLog') {
              ctx.touched = true;
              ctx.touchedModel = ctx.touchedModel ?? model;
            }
            return query(args);
          }

          if (model !== 'AuditLog') {
            ctx.touched = true;
            ctx.touchedModel = ctx.touchedModel ?? model;
          }

          const spec = AUDITED_MODELS[model];
          if (!spec || !isPrimary(model, ctx, args)) return query(args);

          const where = (args as { where?: unknown } | undefined)?.where;
          const before =
            operation === 'create'
              ? null
              : await readRow(reader, model, where, spec.include);

          // Everything above is preparation; from here the user's operation runs
          // untouched and its result is returned whatever the trail makes of it.
          const result = await query(args);

          try {
            const after = isRow(result) ? (result as AuditRow) : null;
            ctx.entry = await describe(
              reader,
              model,
              spec,
              operation,
              before,
              after,
              ctx.intent.entityId
            );
            ctx.captured = true;
          } catch (error) {
            logger.error(
              `Could not describe the ${model} ${operation} for the audit trail: ${(error as Error).message}`
            );
          }

          return result;
        },
      },
    },
  });
}

/**
 * Points the shared client's delegates at an extended copy of itself.
 *
 * $extends returns a new client, and every service already holds the original by
 * injection, so the extension is bound back onto that instance: one line here
 * beats asking sixty call sites to remember.
 */
export function attachAuditTrail(prisma: PrismaClient): void {
  const models = Prisma.dmmf.datamodel.models.map((model) => model.name);
  const delegates = prisma as unknown as Record<string, unknown>;

  const reader: Reader = {};
  for (const model of models) {
    const key = delegateFor(model);
    reader[key] = delegates[key] as Reader[string];
  }

  const extended = prisma.$extends(auditExtension(reader)) as unknown as Record<string, unknown>;
  for (const model of models) {
    const key = delegateFor(model);
    delegates[key] = extended[key];
  }

  // So that work inside an interactive transaction is audited too: the client
  // handed to the callback comes from whichever client opened the transaction.
  delegates.$transaction = (extended.$transaction as (...args: unknown[]) => unknown).bind(extended);
}
