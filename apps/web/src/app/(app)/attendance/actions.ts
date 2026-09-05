'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AttendanceDto } from '@peoplepay360/shared';
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

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

/** datetime-local yields local wall time; convert to ISO so the API stores an instant. */
function toIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export async function createAttendanceAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const checkIn = toIso(str(form, 'checkIn'));
  if (!checkIn) return { error: 'A valid check-in time is required.' };

  const payload = {
    employeeId: str(form, 'employeeId'),
    checkIn,
    checkOut: toIso(str(form, 'checkOut')) ?? null,
    notes: str(form, 'notes') ?? null,
  };

  let created: AttendanceDto;
  try {
    created = await api.post<AttendanceDto>('/attendance', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to create attendance entry.') };
  }

  revalidatePath('/attendance');
  redirect(`/attendance/${created.id}`);
}

export async function updateAttendanceAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  if (!id) return { error: 'Missing attendance id.' };

  const checkIn = toIso(str(form, 'checkIn'));
  if (!checkIn) return { error: 'A valid check-in time is required.' };

  try {
    await api.patch(`/attendance/${id}`, {
      checkIn,
      checkOut: toIso(str(form, 'checkOut')) ?? null,
      status: str(form, 'status'),
      notes: str(form, 'notes') ?? null,
      editReason: str(form, 'editReason'),
    });
  } catch (err) {
    return { error: toMessage(err, 'Failed to update attendance entry.') };
  }

  revalidatePath('/attendance');
  revalidatePath(`/attendance/${id}`);
  return { success: 'Attendance record updated.' };
}

export async function deleteAttendanceAction(id: string): Promise<void> {
  await api.delete(`/attendance/${id}`);
  revalidatePath('/attendance');
  redirect('/attendance');
}

export async function checkInAction(): Promise<void> {
  await api.post('/attendance/check-in');
  revalidatePath('/my-space');
  revalidatePath('/attendance');
}

export async function checkOutAction(): Promise<void> {
  await api.post('/attendance/check-out');
  revalidatePath('/my-space');
  revalidatePath('/attendance');
}
