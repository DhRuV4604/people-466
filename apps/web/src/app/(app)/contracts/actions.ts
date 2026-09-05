'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ContractDto } from '@peoplepay360/shared';
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

function nullable(form: FormData, key: string): string | null {
  return str(form, key) ?? null;
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

function buildPayload(form: FormData) {
  const wageRaw = str(form, 'wage');
  return {
    name: str(form, 'name'),
    employeeId: str(form, 'employeeId'),
    dateStart: str(form, 'dateStart'),
    dateEnd: nullable(form, 'dateEnd'),
    status: str(form, 'status'),
    wage: wageRaw === undefined ? undefined : Number(wageRaw),
    contractType: str(form, 'contractType'),
    jobPositionId: nullable(form, 'jobPositionId'),
    workingScheduleId: nullable(form, 'workingScheduleId'),
    salaryStructureId: nullable(form, 'salaryStructureId'),
    notes: nullable(form, 'notes'),
  };
}

export async function createContractAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const payload = buildPayload(form);

  if (!payload.employeeId || !payload.dateStart || payload.wage === undefined) {
    return { error: 'Employee, start date and wage are required.' };
  }
  if (Number.isNaN(payload.wage)) return { error: 'Wage must be a number.' };

  let created: ContractDto;
  try {
    created = await api.post<ContractDto>('/contracts', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to create contract.') };
  }

  revalidatePath('/contracts');
  redirect(`/contracts/${created.id}`);
}

export async function updateContractAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing contract id.' };

  const payload = buildPayload(form);
  if (payload.wage !== undefined && Number.isNaN(payload.wage)) {
    return { error: 'Wage must be a number.' };
  }

  try {
    // employeeId cannot be reassigned on an existing contract.
    const { employeeId, ...rest } = payload;
    void employeeId;
    await api.patch(`/contracts/${id}`, rest);
  } catch (err) {
    return { error: toMessage(err, 'Failed to update contract.') };
  }

  revalidatePath('/contracts');
  revalidatePath(`/contracts/${id}`);
  return { success: 'Contract saved.' };
}

export async function deleteContractAction(id: string): Promise<void> {
  await api.delete(`/contracts/${id}`);
  revalidatePath('/contracts');
  redirect('/contracts');
}
