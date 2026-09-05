import { prisma } from './prisma';
import { eachDay, round2, startOfDay, endOfDay } from './utils';
import { scheduledDays, averageDayHours, type ScheduleLineInput } from './schedule';

export const LEAVE_STATUSES = ['DRAFT', 'TO_APPROVE', 'APPROVED', 'REFUSED', 'CANCELLED'] as const;
export const ALLOCATION_STATUSES = ['DRAFT', 'APPROVED', 'REFUSED'] as const;

/**
 * Leave duration counts only days the employee was actually scheduled to work,
 * so a Fri–Mon request on a Mon–Fri schedule costs 2 days, not 4.
 */
export function computeLeaveDuration(
  from: Date,
  to: Date,
  scheduleLines: ScheduleLineInput[],
  unit: 'DAY' | 'HOUR'
): number {
  const working = scheduleLines.length > 0 ? scheduledDays(scheduleLines) : new Set([1, 2, 3, 4, 5]);
  const days = eachDay(from, to).filter((d) => working.has(d.getDay())).length;

  if (unit === 'HOUR') {
    const perDay = scheduleLines.length > 0 ? averageDayHours(scheduleLines) : 8;
    return round2(days * perDay);
  }
  return days;
}

export interface LeaveBalance {
  typeId: string;
  typeName: string;
  typeCode: string;
  unit: string;
  colorHex: string;
  requiresAllocation: boolean;
  allocated: number;
  taken: number;
  pending: number;
  remaining: number;
}

/**
 * Balance = approved allocations − approved requests, with pending requests shown
 * separately so an employee can see what is still awaiting a decision (spec A4).
 */
export async function getLeaveBalances(
  employeeId: string,
  onDate: Date = new Date()
): Promise<LeaveBalance[]> {
  const [types, allocations, requests] = await Promise.all([
    prisma.timeOffType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.leaveAllocation.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        validFrom: { lte: onDate },
        OR: [{ validTo: null }, { validTo: { gte: onDate } }],
      },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId, status: { in: ['APPROVED', 'TO_APPROVE'] } },
    }),
  ]);

  return types.map((type) => {
    const allocated = allocations
      .filter((a) => a.typeId === type.id)
      .reduce((s, a) => s + a.quantity, 0);

    const taken = requests
      .filter((r) => r.typeId === type.id && r.status === 'APPROVED')
      .reduce((s, r) => s + r.duration, 0);

    const pending = requests
      .filter((r) => r.typeId === type.id && r.status === 'TO_APPROVE')
      .reduce((s, r) => s + r.duration, 0);

    return {
      typeId: type.id,
      typeName: type.name,
      typeCode: type.code,
      unit: type.unit,
      colorHex: type.colorHex,
      requiresAllocation: type.requiresAllocation,
      allocated: round2(allocated),
      taken: round2(taken),
      pending: round2(pending),
      remaining: round2(allocated - taken),
    };
  });
}

/** The allocation an approval should draw from: valid, approved, soonest to expire. */
export async function findConsumableAllocation(
  employeeId: string,
  typeId: string,
  onDate: Date
) {
  const allocations = await prisma.leaveAllocation.findMany({
    where: {
      employeeId,
      typeId,
      status: 'APPROVED',
      validFrom: { lte: onDate },
      OR: [{ validTo: null }, { validTo: { gte: onDate } }],
    },
    orderBy: [{ validTo: 'asc' }, { validFrom: 'asc' }],
  });
  return allocations[0] ?? null;
}

export interface LeaveValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  allocationId?: string | null;
}

/**
 * Pre-flight checks run before a request is created or approved: overlapping
 * leave, exhausted balance for allocation-backed types, and per-request caps.
 */
export async function validateLeaveRequest(params: {
  employeeId: string;
  typeId: string;
  dateFrom: Date;
  dateTo: Date;
  duration: number;
  excludeRequestId?: string;
}): Promise<LeaveValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const type = await prisma.timeOffType.findUnique({ where: { id: params.typeId } });
  if (!type) return { ok: false, errors: ['Time off type not found.'], warnings };

  if (params.dateTo < params.dateFrom) {
    errors.push('End date cannot be before the start date.');
  }
  if (params.duration <= 0) {
    errors.push('The selected range contains no scheduled working days.');
  }
  if (type.maxDaysPerRequest && params.duration > type.maxDaysPerRequest) {
    errors.push(
      `${type.name} allows at most ${type.maxDaysPerRequest} ${type.unit.toLowerCase()}(s) per request.`
    );
  }

  const overlapping = await prisma.leaveRequest.findMany({
    where: {
      employeeId: params.employeeId,
      status: { in: ['TO_APPROVE', 'APPROVED'] },
      ...(params.excludeRequestId ? { id: { not: params.excludeRequestId } } : {}),
      dateFrom: { lte: endOfDay(params.dateTo) },
      dateTo: { gte: startOfDay(params.dateFrom) },
    },
    include: { type: true },
  });
  if (overlapping.length > 0) {
    errors.push(
      `Overlaps an existing ${overlapping[0].type.name} request for the same dates.`
    );
  }

  let allocationId: string | null = null;
  if (type.requiresAllocation) {
    const balances = await getLeaveBalances(params.employeeId, params.dateFrom);
    const balance = balances.find((b) => b.typeId === params.typeId);

    if (!balance || balance.allocated === 0) {
      // Distinguish "never allocated" from "allocated, but not valid on these dates",
      // which is otherwise a confusing message for a future-dated request.
      const anyAllocation = await prisma.leaveAllocation.findFirst({
        where: { employeeId: params.employeeId, typeId: params.typeId, status: 'APPROVED' },
      });
      errors.push(
        anyAllocation
          ? `No ${type.name} allocation is valid on the requested dates; the existing allocation covers a different period.`
          : `No approved ${type.name} allocation exists for this employee.`
      );
    } else if (balance.remaining < params.duration) {
      errors.push(
        `Insufficient ${type.name} balance: ${balance.remaining} remaining, ${params.duration} requested.`
      );
    } else if (balance.remaining - params.duration < 1) {
      warnings.push(`This will nearly exhaust the ${type.name} balance.`);
    }

    const allocation = await findConsumableAllocation(
      params.employeeId,
      params.typeId,
      params.dateFrom
    );
    allocationId = allocation?.id ?? null;
  }

  return { ok: errors.length === 0, errors, warnings, allocationId };
}

/** Approved leave days overlapping a payroll period, used for payslip worked days. */
export async function approvedLeaveDaysInPeriod(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ total: number; paid: number; unpaid: number }> {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: 'APPROVED',
      dateFrom: { lte: periodEnd },
      dateTo: { gte: periodStart },
    },
    include: { type: true },
  });

  let paid = 0;
  let unpaid = 0;

  for (const r of requests) {
    // Only count the portion of the request that falls inside the period.
    const from = r.dateFrom < periodStart ? periodStart : r.dateFrom;
    const to = r.dateTo > periodEnd ? periodEnd : r.dateTo;
    const fullSpan = eachDay(r.dateFrom, r.dateTo).length || 1;
    const inPeriod = eachDay(from, to).length;
    const portion = round2(r.duration * (inPeriod / fullSpan));

    if (r.type.paid) paid += portion;
    else unpaid += portion;
  }

  return { total: round2(paid + unpaid), paid: round2(paid), unpaid: round2(unpaid) };
}
