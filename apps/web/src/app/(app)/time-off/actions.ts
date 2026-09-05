'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { LeaveRequestDto, LeaveAllocationDto } from '@peoplepay360/shared';
import { api, ApiError } from '@/lib/api-client';

export interface ActionState {
  error?: string;
  success?: string;
  warnings?: string[];
}

function str(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------- Types

export async function saveTimeOffTypeAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const maxDays = str(form, 'maxDaysPerRequest');

  const payload = {
    name: str(form, 'name'),
    code: str(form, 'code'),
    unit: str(form, 'unit') ?? 'DAY',
    requiresAllocation: bool(form, 'requiresAllocation'),
    requiresApproval: bool(form, 'requiresApproval'),
    paid: bool(form, 'paid'),
    colorHex: str(form, 'colorHex') ?? '#2563eb',
    maxDaysPerRequest: maxDays ? Number(maxDays) : undefined,
    active: bool(form, 'active'),
  };

  if (!payload.name || !payload.code) return { error: 'Name and code are required.' };

  try {
    if (id) await api.patch(`/time-off/types/${id}`, payload);
    else await api.post('/time-off/types', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to save time off type.') };
  }

  revalidatePath('/time-off/types');
  return { success: 'Time off type saved.' };
}

export async function deleteTimeOffTypeAction(id: string): Promise<void> {
  await api.delete(`/time-off/types/${id}`);
  revalidatePath('/time-off/types');
}

// ---------------------------------------------------------------- Allocations

export async function saveAllocationAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const quantityRaw = str(form, 'quantity');

  const payload = {
    employeeId: str(form, 'employeeId'),
    typeId: str(form, 'typeId'),
    quantity: quantityRaw === undefined ? undefined : Number(quantityRaw),
    validFrom: str(form, 'validFrom'),
    validTo: str(form, 'validTo') ?? null,
    status: str(form, 'status') ?? 'DRAFT',
    notes: str(form, 'notes') ?? null,
  };

  if (!payload.employeeId || !payload.typeId || payload.quantity === undefined || !payload.validFrom) {
    return { error: 'Employee, type, quantity and valid-from date are required.' };
  }

  let created: LeaveAllocationDto | undefined;
  try {
    if (id) {
      const { employeeId, ...rest } = payload;
      void employeeId;
      await api.patch(`/time-off/allocations/${id}`, rest);
    } else {
      created = await api.post<LeaveAllocationDto>('/time-off/allocations', payload);
    }
  } catch (err) {
    return { error: toMessage(err, 'Failed to save allocation.') };
  }

  revalidatePath('/time-off/allocations');
  if (created) redirect(`/time-off/allocations/${created.id}`);
  return { success: 'Allocation saved.' };
}

export async function approveAllocationAction(id: string): Promise<void> {
  await api.post(`/time-off/allocations/${id}/approve`);
  revalidatePath('/time-off/allocations');
  revalidatePath(`/time-off/allocations/${id}`);
}

export async function refuseAllocationAction(id: string): Promise<void> {
  await api.post(`/time-off/allocations/${id}/refuse`);
  revalidatePath('/time-off/allocations');
  revalidatePath(`/time-off/allocations/${id}`);
}

export async function deleteAllocationAction(id: string): Promise<void> {
  await api.delete(`/time-off/allocations/${id}`);
  revalidatePath('/time-off/allocations');
  redirect('/time-off/allocations');
}

// ---------------------------------------------------------------- Requests

export async function saveLeaveRequestAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');

  const payload = {
    employeeId: str(form, 'employeeId'),
    typeId: str(form, 'typeId'),
    dateFrom: str(form, 'dateFrom'),
    dateTo: str(form, 'dateTo'),
    reason: str(form, 'reason') ?? null,
  };

  if (!payload.typeId || !payload.dateFrom || !payload.dateTo) {
    return { error: 'Type, start date and end date are required.' };
  }

  let created: LeaveRequestDto | undefined;
  try {
    if (id) {
      const { employeeId, ...rest } = payload;
      void employeeId;
      await api.patch(`/time-off/requests/${id}`, rest);
    } else {
      created = await api.post<LeaveRequestDto>('/time-off/requests', payload);
    }
  } catch (err) {
    return { error: toMessage(err, 'Failed to save request.') };
  }

  revalidatePath('/time-off/requests');
  if (created) redirect(`/time-off/requests/${created.id}`);
  return { success: 'Request saved.' };
}

export async function approveLeaveRequestAction(id: string): Promise<void> {
  await api.post(`/time-off/requests/${id}/approve`);
  revalidatePath('/time-off/requests');
  revalidatePath(`/time-off/requests/${id}`);
}

export async function refuseLeaveRequestAction(id: string, reason: string): Promise<void> {
  await api.post(`/time-off/requests/${id}/refuse`, { reason });
  revalidatePath('/time-off/requests');
  revalidatePath(`/time-off/requests/${id}`);
}

export async function cancelLeaveRequestAction(id: string): Promise<void> {
  await api.post(`/time-off/requests/${id}/cancel`);
  revalidatePath('/time-off/requests');
  revalidatePath(`/time-off/requests/${id}`);
}

export async function deleteLeaveRequestAction(id: string): Promise<void> {
  await api.delete(`/time-off/requests/${id}`);
  revalidatePath('/time-off/requests');
  redirect('/time-off/requests');
}
