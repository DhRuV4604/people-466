import type { AuditAction } from '@peoplepay360/shared';
import type { AuditIntent } from './audit-context';

/**
 * What each audited model is called, and what a diff of it should ignore.
 *
 * Everything here answers one question: reading this row back in a year, does a
 * person know which record was touched? An id does not tell them, so every
 * model has to be able to name itself, and the few that can only be named
 * through a relation carry the include needed to do it.
 */

export type AuditRow = Record<string, unknown>;

export interface ModelSpec {
  /** Relations needed to name the record. */
  include?: Record<string, unknown>;
  label(row: AuditRow): string | null;
  /**
   * Columns nobody chose: recomputed by the service from other fields written
   * in the same request, or stamped by it to record the very act the row is
   * already recording. A diff of them echoes the change rather than describing
   * it - a refusal that lists `refusedBy` and `refusedAt` next to the name and
   * the time of the person who refused it says nothing twice, and `allocationId`
   * says it in a cuid. They stay in a delete snapshot, which is the record
   * itself rather than an account of a decision.
   */
  derived?: readonly string[];
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const person = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as AuditRow;
  const parts = [text(row.firstName), text(row.lastName)].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
};

const named = (value: unknown): string | null =>
  value && typeof value === 'object' ? text((value as AuditRow).name) : null;

const day = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value.slice(0, 10) : null;
};

const join = (...parts: (string | null)[]): string | null => {
  const kept = parts.filter((p): p is string => Boolean(p));
  return kept.length > 0 ? kept.join(' — ') : null;
};

const EMPLOYEE_NAME = { employee: { select: { firstName: true, lastName: true } } };

/**
 * Absent on purpose: WorkingScheduleLine and PayslipLine are rewritten wholesale
 * whenever their parent is saved, so they are churn rather than intent; EmailLog
 * and Notification are what the system emitted, not what someone did; AuditLog
 * is never audited at all.
 */
export const AUDITED_MODELS: Record<string, ModelSpec> = {
  User: { label: (r) => text(r.name) ?? text(r.email) },
  Employee: { label: (r) => person(r) ?? text(r.employeeCode) },
  Department: { label: (r) => text(r.name) },
  JobPosition: { label: (r) => text(r.name) },
  WorkingSchedule: { label: (r) => text(r.name), derived: ['hoursPerWeek'] },
  Contract: { label: (r) => text(r.name) },
  Attendance: {
    include: EMPLOYEE_NAME,
    label: (r) => join(person(r.employee), day(r.checkIn)),
    // editReason is left in: the words are the correction's justification, and
    // the only part of it the trail does not already hold.
    derived: ['workedHours', 'overtimeHours', 'manuallyEdited', 'editedById', 'editedAt'],
  },
  TimeOffType: { label: (r) => text(r.name) },
  LeaveAllocation: {
    include: { ...EMPLOYEE_NAME, type: { select: { name: true } } },
    label: (r) => join(person(r.employee), named(r.type)),
    derived: ['approvedBy', 'approvedAt'],
  },
  LeaveRequest: {
    include: { ...EMPLOYEE_NAME, type: { select: { name: true } } },
    label: (r) => join(person(r.employee), named(r.type), `${day(r.dateFrom)} to ${day(r.dateTo)}`),
    // duration follows the dates, and the allocation the request consumes is
    // picked by the approval rather than by anyone; refuseReason stays.
    derived: ['duration', 'allocationId', 'approvedBy', 'approvedAt', 'refusedBy', 'refusedAt'],
  },
  SalaryStructure: { label: (r) => text(r.name) },
  SalaryRule: {
    label: (r) => (text(r.name) && text(r.code) ? `${text(r.name)} (${text(r.code)})` : text(r.name)),
  },
  Payrun: {
    label: (r) => text(r.name),
    // Each is stamped by the verb route that also moves `status`, so the status
    // line and the row's own action already say both what and when.
    derived: ['computedAt', 'validatedAt', 'paidAt', 'paidBy'],
  },
  // The computed totals are deliberately not derived here: a recompute is the
  // one action whose whole point is what the money became.
  Payslip: {
    include: EMPLOYEE_NAME,
    label: (r) => join(person(r.employee), text(r.number)),
  },
};

/** Prisma exposes `Employee` as `prisma.employee`. */
export function delegateFor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Path segment to model. Two-segment resources come first so `time-off/types`
 * is not read as the `time-off` collection.
 */
const RESOURCE_MODELS: readonly (readonly [string, string])[] = [
  ['time-off/types', 'TimeOffType'],
  ['time-off/allocations', 'LeaveAllocation'],
  ['time-off/requests', 'LeaveRequest'],
  ['employees', 'Employee'],
  ['contracts', 'Contract'],
  ['attendance', 'Attendance'],
  ['payruns', 'Payrun'],
  ['payslips', 'Payslip'],
  ['salary-structures', 'SalaryStructure'],
  ['salary-rules', 'SalaryRule'],
  ['working-schedules', 'WorkingSchedule'],
  ['departments', 'Department'],
  ['job-positions', 'JobPosition'],
  ['documents', 'Document'],
];

/**
 * The verbs POST cannot express. Approving a leave request is not creating one,
 * and an admin looking for who approved it will search for APPROVE.
 */
const ROUTE_VERBS: Record<string, AuditAction> = {
  approve: 'APPROVE',
  refuse: 'REFUSE',
  cancel: 'CANCEL',
  compute: 'COMPUTE',
  recompute: 'COMPUTE',
  validate: 'VALIDATE',
  'mark-paid': 'PAY',
  'send-payslips': 'SEND',
};

/**
 * Ids are cuids. Matching the shape rather than a fixed length keeps this
 * working if the id strategy changes, exactly as common/validation does.
 */
const ENTITY_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function routeIntent(path: string): AuditIntent {
  const segments = path.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments[0] === 'api') segments.shift();

  let model: string | null = null;
  let rest: string[] = [];

  for (const [resource, candidate] of RESOURCE_MODELS) {
    const parts = resource.split('/');
    if (parts.every((part, i) => segments[i] === part)) {
      model = candidate;
      rest = segments.slice(parts.length);
      break;
    }
  }

  const entityId = rest.find((segment) => ENTITY_ID.test(segment)) ?? null;
  const verb = rest.length > 0 ? ROUTE_VERBS[rest[rest.length - 1]] : undefined;

  return { model, entityId, action: verb ?? null };
}

/** What the HTTP verb alone implies, used only when nothing better is known. */
export function methodAction(method: string): AuditAction {
  if (method === 'DELETE') return 'DELETE';
  if (method === 'POST') return 'CREATE';
  return 'UPDATE';
}

/**
 * What the write actually did, which can disagree with the route: deleting an
 * employee who has payslips archives them instead, and the trail should say so.
 */
export function observedAction(operation: string, hadBefore: boolean): AuditAction {
  if (operation === 'create') return 'CREATE';
  if (operation === 'delete') return 'DELETE';
  if (operation === 'upsert') return hadBefore ? 'UPDATE' : 'CREATE';
  return 'UPDATE';
}
