'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EmployeeDetailDto } from '@peoplepay360/shared';
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

/** Empty form fields must clear the stored value, so send null rather than omit. */
function nullable(form: FormData, key: string): string | null {
  return str(form, key) ?? null;
}

function buildPayload(form: FormData) {
  return {
    firstName: str(form, 'firstName'),
    lastName: str(form, 'lastName'),
    workEmail: str(form, 'workEmail'),
    workPhone: nullable(form, 'workPhone'),
    dateOfBirth: nullable(form, 'dateOfBirth'),
    gender: nullable(form, 'gender'),
    address: nullable(form, 'address'),
    bankName: nullable(form, 'bankName'),
    bankAccountNumber: nullable(form, 'bankAccountNumber'),
    employeeType: str(form, 'employeeType'),
    status: str(form, 'status'),
    hireDate: str(form, 'hireDate'),
    departmentId: nullable(form, 'departmentId'),
    jobPositionId: nullable(form, 'jobPositionId'),
    managerId: nullable(form, 'managerId'),
    workingScheduleId: nullable(form, 'workingScheduleId'),
  };
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

export async function createEmployeeAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const payload = buildPayload(form);

  if (!payload.firstName || !payload.lastName || !payload.workEmail || !payload.hireDate) {
    return { error: 'First name, last name, work email and hire date are required.' };
  }

  let created: EmployeeDetailDto;
  try {
    created = await api.post<EmployeeDetailDto>('/employees', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to create employee.') };
  }

  revalidatePath('/employees');
  redirect(`/employees/${created.id}`);
}

export async function updateEmployeeAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing employee id.' };

  const payload = { ...buildPayload(form), exitDate: nullable(form, 'exitDate') };

  if (!payload.firstName || !payload.lastName || !payload.workEmail || !payload.hireDate) {
    return { error: 'First name, last name, work email and hire date are required.' };
  }

  try {
    await api.patch(`/employees/${id}`, payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to update employee.') };
  }

  revalidatePath('/employees');
  revalidatePath(`/employees/${id}`);
  return { success: 'Employee saved.' };
}

export async function deleteEmployeeAction(id: string): Promise<void> {
  await api.delete(`/employees/${id}`);
  revalidatePath('/employees');
  redirect('/employees');
}
