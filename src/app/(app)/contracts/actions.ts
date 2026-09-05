'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { findOverlappingContracts } from '@/lib/contracts';
import { formatDate } from '@/lib/utils';

export interface ActionState {
  error?: string;
  success?: string;
}

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function buildContractData(form: FormData, contractId?: string) {
  const employeeId = str(form, 'employeeId');
  const dateStartRaw = str(form, 'dateStart');
  const wage = num(form, 'wage');
  const status = str(form, 'status') ?? 'DRAFT';

  if (!employeeId || !dateStartRaw || wage === null) {
    return { error: 'Employee, start date and wage are required.' as const };
  }
  if (wage < 0) return { error: 'Wage cannot be negative.' as const };

  const dateStart = new Date(dateStartRaw);
  const dateEndRaw = str(form, 'dateEnd');
  const dateEnd = dateEndRaw ? new Date(dateEndRaw) : null;

  if (dateEnd && dateEnd < dateStart) {
    return { error: 'End date cannot be before the start date.' as const };
  }

  // Enforce the "no concurrent active contracts" rule from spec A2.
  const overlaps = await findOverlappingContracts({
    employeeId,
    dateStart,
    dateEnd,
    excludeContractId: contractId,
    status,
  });

  if (overlaps.length > 0) {
    const o = overlaps[0];
    return {
      error: `This overlaps a running contract (${formatDate(o.dateStart)} — ${
        o.dateEnd ? formatDate(o.dateEnd) : 'open ended'
      }). Close it first, or change these dates.` as const,
    };
  }

  return {
    data: {
      name: str(form, 'name') ?? 'Employment Contract',
      employeeId,
      dateStart,
      dateEnd,
      status,
      wage,
      contractType: str(form, 'contractType') ?? 'PERMANENT',
      jobPositionId: str(form, 'jobPositionId'),
      workingScheduleId: str(form, 'workingScheduleId'),
      salaryStructureId: str(form, 'salaryStructureId'),
      notes: str(form, 'notes'),
    },
  };
}

export async function createContractAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  await requirePermission('contracts', 'create');

  const result = await buildContractData(form);
  if ('error' in result) return { error: result.error };

  let contract;
  try {
    contract = await prisma.contract.create({ data: result.data });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create contract.' };
  }

  revalidatePath('/contracts');
  redirect(`/contracts/${contract.id}`);
}

export async function updateContractAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  await requirePermission('contracts', 'update');

  const id = str(form, 'id');
  if (!id) return { error: 'Missing contract id.' };

  const result = await buildContractData(form, id);
  if ('error' in result) return { error: result.error };

  try {
    await prisma.contract.update({ where: { id }, data: result.data });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update contract.' };
  }

  revalidatePath('/contracts');
  revalidatePath(`/contracts/${id}`);
  return { success: 'Contract saved.' };
}

export async function deleteContractAction(id: string): Promise<void> {
  await requirePermission('contracts', 'delete');

  // A contract referenced by payslips is historical evidence; cancel rather than delete.
  const payslipCount = await prisma.payslip.count({ where: { contractId: id } });
  if (payslipCount > 0) {
    await prisma.contract.update({ where: { id }, data: { status: 'CANCELLED' } });
  } else {
    await prisma.contract.delete({ where: { id } });
  }

  revalidatePath('/contracts');
  redirect('/contracts');
}
