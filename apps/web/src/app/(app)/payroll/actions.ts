'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  SalaryStructureDto,
  PayrunDto,
  EligibleEmployeeDto,
  SendPayslipsResultDto,
} from '@peoplepay360/shared';
import { api, ApiError } from '@/lib/api-client';

export interface ActionState {
  error?: string;
  success?: string;
}

function str(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

function num(form: FormData, key: string): number | undefined {
  const value = str(form, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------- Structures

export async function saveStructureAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const payload = {
    name: str(form, 'name'),
    code: str(form, 'code'),
    description: str(form, 'description') ?? null,
    active: bool(form, 'active'),
  };

  if (!payload.name || !payload.code) return { error: 'Name and code are required.' };

  let created: SalaryStructureDto | undefined;
  try {
    if (id) await api.patch(`/salary-structures/${id}`, payload);
    else created = await api.post<SalaryStructureDto>('/salary-structures', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to save structure.') };
  }

  revalidatePath('/payroll/structures');
  if (created) redirect(`/payroll/structures/${created.id}`);
  return { success: 'Structure saved.' };
}

export async function deleteStructureAction(id: string): Promise<void> {
  await api.delete(`/salary-structures/${id}`);
  revalidatePath('/payroll/structures');
  redirect('/payroll/structures');
}

// ---------------------------------------------------------------- Rules

export async function saveRuleAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const computeType = str(form, 'computeType') ?? 'FIXED';

  const payload = {
    name: str(form, 'name'),
    code: str(form, 'code'),
    structureId: str(form, 'structureId'),
    category: str(form, 'category'),
    sequence: num(form, 'sequence') ?? 100,
    computeType,
    // Only send the field relevant to the compute type; the API clears the rest.
    amountFixed: computeType === 'FIXED' ? num(form, 'amountFixed') : undefined,
    amountPercentage: computeType === 'PERCENTAGE' ? num(form, 'amountPercentage') : undefined,
    percentageBase: computeType === 'PERCENTAGE' ? str(form, 'percentageBase') : undefined,
    formula: computeType === 'FORMULA' ? str(form, 'formula') : undefined,
    condition: str(form, 'condition'),
    appearsOnPayslip: bool(form, 'appearsOnPayslip'),
    active: bool(form, 'active'),
    note: str(form, 'note') ?? null,
  };

  if (!payload.name || !payload.code || !payload.structureId || !payload.category) {
    return { error: 'Name, code, structure and category are required.' };
  }

  try {
    if (id) await api.patch(`/salary-rules/${id}`, payload);
    else await api.post('/salary-rules', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to save rule.') };
  }

  revalidatePath('/payroll/rules');
  revalidatePath(`/payroll/structures/${payload.structureId}`);
  return { success: 'Rule saved.' };
}

export async function deleteRuleAction(id: string): Promise<void> {
  await api.delete(`/salary-rules/${id}`);
  revalidatePath('/payroll/rules');
  revalidatePath('/payroll/structures');
}

// ---------------------------------------------------------------- Pay runs

/** Wizard step 2 data: who can be paid for the chosen scope. */
export async function fetchEligibleEmployees(input: {
  periodStart: string;
  periodEnd: string;
  structureId: string;
  departmentId?: string;
  employeeType?: string;
}): Promise<EligibleEmployeeDto[]> {
  return api.get<EligibleEmployeeDto[]>('/payruns/eligible-employees', {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    structureId: input.structureId,
    departmentId: input.departmentId,
    employeeType: input.employeeType,
  });
}

export async function createPayrunAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const employeeIds = form.getAll('employeeIds').map(String).filter(Boolean);

  const payload = {
    name: str(form, 'name'),
    structureId: str(form, 'structureId'),
    periodStart: str(form, 'periodStart'),
    periodEnd: str(form, 'periodEnd'),
    employeeIds,
    departmentId: str(form, 'departmentId'),
    employeeType: str(form, 'employeeType'),
  };

  if (!payload.name || !payload.structureId || !payload.periodStart || !payload.periodEnd) {
    return { error: 'Name, structure and period are required.' };
  }
  if (employeeIds.length === 0) {
    return { error: 'Select at least one employee for this pay run.' };
  }

  let created: PayrunDto;
  try {
    created = await api.post<PayrunDto>('/payruns', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to create pay run.') };
  }

  revalidatePath('/payroll/payruns');
  redirect(`/payroll/payruns/${created.id}`);
}

export async function computePayrunAction(id: string): Promise<void> {
  await api.post(`/payruns/${id}/compute`);
  revalidatePath(`/payroll/payruns/${id}`);
  revalidatePath('/payroll/payslips');
}

export async function validatePayrunAction(id: string): Promise<void> {
  await api.post(`/payruns/${id}/validate`);
  revalidatePath(`/payroll/payruns/${id}`);
  revalidatePath('/payroll/payslips');
}

export async function markPayrunPaidAction(id: string): Promise<void> {
  await api.post(`/payruns/${id}/mark-paid`);
  revalidatePath(`/payroll/payruns/${id}`);
  revalidatePath('/payroll/payslips');
  revalidatePath('/dashboard');
}

export async function sendPayslipsAction(id: string): Promise<SendPayslipsResultDto> {
  const result = await api.post<SendPayslipsResultDto>(`/payruns/${id}/send-payslips`);
  revalidatePath(`/payroll/payruns/${id}`);
  revalidatePath('/payroll/outbox');
  return result;
}

export async function deletePayrunAction(id: string): Promise<void> {
  await api.delete(`/payruns/${id}`);
  revalidatePath('/payroll/payruns');
  redirect('/payroll/payruns');
}

export async function recomputePayslipAction(id: string): Promise<void> {
  await api.post(`/payslips/${id}/recompute`);
  revalidatePath(`/payroll/payslips/${id}`);
}
