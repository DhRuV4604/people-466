'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { resolveContractForPeriod } from '@/lib/contracts';
import { formatDate } from '@/lib/utils';

export interface EligibleEmployee {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  employeeType: string;
  wage: number;
  contractName: string;
  eligible: boolean;
  /** Why the employee cannot be included, when not eligible. */
  reason: string | null;
  warning: string | null;
}

/**
 * Step 2 of the wizard: work out who can actually be paid for this period.
 * An employee is eligible only when a RUNNING contract overlaps the period and
 * they do not already hold a payslip covering it.
 */
export async function getEligibleEmployees(input: {
  periodStart: string;
  periodEnd: string;
  departmentId?: string | null;
  employeeType?: string | null;
  structureId: string;
}): Promise<EligibleEmployee[]> {
  await requirePermission('payruns', 'create');

  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);

  const employees = await prisma.employee.findMany({
    where: {
      status: { not: 'INACTIVE' },
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.employeeType ? { employeeType: input.employeeType } : {}),
    },
    include: {
      department: true,
      contracts: { include: { salaryStructure: true } },
    },
    orderBy: [{ firstName: 'asc' }],
  });

  // Existing payslips covering the same period would be duplicates.
  const existing = await prisma.payslip.findMany({
    where: {
      status: { not: 'CANCELLED' },
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
    },
    include: { payrun: true },
  });

  return employees.map((e) => {
    const contract = resolveContractForPeriod(e.contracts, periodStart, periodEnd);
    const duplicate = existing.find((p) => p.employeeId === e.id);

    let eligible = true;
    let reason: string | null = null;
    let warning: string | null = null;

    if (!contract) {
      eligible = false;
      reason = `No running contract covering ${formatDate(periodStart)} — ${formatDate(periodEnd)}`;
    } else if (duplicate) {
      eligible = false;
      reason = `Already has payslip ${duplicate.number} in "${duplicate.payrun?.name ?? 'another run'}"`;
    }

    if (eligible && (!e.bankAccountNumber || !e.bankName)) {
      warning = 'Missing bank details — payment cannot be released';
    }
    // Flag when the employee's own contract points at a different structure.
    if (eligible && contract?.salaryStructureId && contract.salaryStructureId !== input.structureId) {
      warning = warning
        ? `${warning}; contract uses "${contract.salaryStructure?.name}"`
        : `Contract normally uses "${contract.salaryStructure?.name}"`;
    }

    return {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      employeeCode: e.employeeCode,
      department: e.department?.name ?? '—',
      employeeType: e.employeeType,
      wage: contract?.wage ?? 0,
      contractName: contract?.name ?? '—',
      eligible,
      reason,
      warning,
    };
  });
}
