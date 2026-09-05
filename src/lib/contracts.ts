import { prisma } from './prisma';
import { rangesOverlap } from './utils';

export interface ContractLike {
  id: string;
  dateStart: Date;
  dateEnd: Date | null;
  status: string;
  wage: number;
}

/**
 * Resolve the single contract that governs a payroll period (spec A2/B7).
 *
 * A contract qualifies when it is RUNNING and its date range overlaps the period.
 * When several qualify - which the overlap guard below is meant to prevent, but
 * legacy data may still contain - the one starting latest wins, since that is the
 * most recent terms the employee agreed to.
 */
export function resolveContractForPeriod<T extends ContractLike>(
  contracts: T[],
  periodStart: Date,
  periodEnd: Date
): T | null {
  const applicable = contracts
    .filter((c) => c.status === 'RUNNING')
    .filter((c) => rangesOverlap(c.dateStart, c.dateEnd, periodStart, periodEnd));

  if (applicable.length === 0) return null;

  return applicable.sort((a, b) => b.dateStart.getTime() - a.dateStart.getTime())[0];
}

export async function getContractForPeriod(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const contracts = await prisma.contract.findMany({
    where: { employeeId },
    include: {
      salaryStructure: true,
      workingSchedule: { include: { lines: true } },
      jobPosition: true,
    },
    orderBy: { dateStart: 'desc' },
  });

  return resolveContractForPeriod(contracts, periodStart, periodEnd);
}

/**
 * Guard against concurrent RUNNING contracts for one employee (spec A2).
 * Returns the conflicting contracts, empty when the range is clear.
 */
export async function findOverlappingContracts(params: {
  employeeId: string;
  dateStart: Date;
  dateEnd: Date | null;
  excludeContractId?: string;
  status: string;
}) {
  if (params.status !== 'RUNNING') return [];

  const existing = await prisma.contract.findMany({
    where: {
      employeeId: params.employeeId,
      status: 'RUNNING',
      ...(params.excludeContractId ? { id: { not: params.excludeContractId } } : {}),
    },
  });

  return existing.filter((c) =>
    rangesOverlap(c.dateStart, c.dateEnd, params.dateStart, params.dateEnd)
  );
}

/** Contracts ending within `days` need HR attention; surfaced on the dashboard. */
export async function findExpiringContracts(days = 30) {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return prisma.contract.findMany({
    where: {
      status: 'RUNNING',
      dateEnd: { not: null, gte: now, lte: horizon },
    },
    include: { employee: { include: { department: true } } },
    orderBy: { dateEnd: 'asc' },
  });
}

/**
 * Employees with no RUNNING contract covering the period cannot be paid, so the
 * payrun wizard filters them out and the dashboard flags them.
 */
export async function employeesWithoutValidContract(periodStart: Date, periodEnd: Date) {
  const employees = await prisma.employee.findMany({
    where: { status: { not: 'INACTIVE' } },
    include: { contracts: true, department: true },
  });

  return employees.filter(
    (e) => resolveContractForPeriod(e.contracts, periodStart, periodEnd) === null
  );
}

export const CONTRACT_STATUSES = ['DRAFT', 'RUNNING', 'EXPIRED', 'CANCELLED'] as const;
export const CONTRACT_TYPES = ['PERMANENT', 'FIXED_TERM', 'INTERNSHIP', 'FREELANCE'] as const;
