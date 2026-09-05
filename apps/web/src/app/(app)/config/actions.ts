'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { WorkingScheduleDto } from '@peoplepay360/shared';
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

function bool(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

function toMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

// ---------------------------------------------------------------- Schedules

/** Parse the repeating day/start/end/break rows posted by the schedule form. */
function parseScheduleLines(form: FormData) {
  const days = form.getAll('lineDay').map(String);
  const starts = form.getAll('lineStart').map(String);
  const ends = form.getAll('lineEnd').map(String);
  const breaks = form.getAll('lineBreak').map(String);

  const lines: { dayOfWeek: number; startTime: string; endTime: string; breakHours: number }[] = [];
  for (let i = 0; i < days.length; i++) {
    // A row with no times is an empty slot the user left blank.
    if (!starts[i] || !ends[i]) continue;
    lines.push({
      dayOfWeek: Number(days[i]),
      startTime: starts[i],
      endTime: ends[i],
      breakHours: Number(breaks[i] || 0),
    });
  }
  return lines;
}

export async function saveScheduleAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const name = str(form, 'name');
  if (!name) return { error: 'Schedule name is required.' };

  const lines = parseScheduleLines(form);
  if (lines.length === 0) {
    return { error: 'Add at least one working day with a start and end time.' };
  }

  // Weekly hours are computed by the API from these lines, never sent by us.
  const payload = {
    name,
    scheduleType: str(form, 'scheduleType') ?? 'FULL_TIME',
    timezone: str(form, 'timezone') ?? 'UTC',
    active: bool(form, 'active'),
    lines,
  };

  let saved: WorkingScheduleDto;
  try {
    saved = id
      ? await api.patch<WorkingScheduleDto>(`/working-schedules/${id}`, payload)
      : await api.post<WorkingScheduleDto>('/working-schedules', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to save schedule.') };
  }

  revalidatePath('/config/schedules');
  if (!id) redirect(`/config/schedules/${saved.id}`);
  return { success: `Schedule saved — ${saved.hoursPerWeek} hours per week.` };
}

export async function deleteScheduleAction(id: string): Promise<void> {
  await api.delete(`/working-schedules/${id}`);
  revalidatePath('/config/schedules');
  redirect('/config/schedules');
}

// ---------------------------------------------------------------- Departments

export async function saveDepartmentAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const name = str(form, 'name');
  if (!name) return { error: 'Department name is required.' };

  const payload = { name, code: str(form, 'code') ?? null };

  try {
    if (id) await api.patch(`/departments/${id}`, payload);
    else await api.post('/departments', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to save department.') };
  }

  revalidatePath('/config/departments');
  return { success: 'Department saved.' };
}

export async function deleteDepartmentAction(id: string): Promise<void> {
  await api.delete(`/departments/${id}`);
  revalidatePath('/config/departments');
}

// ---------------------------------------------------------------- Positions

export async function savePositionAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const name = str(form, 'name');
  if (!name) return { error: 'Position name is required.' };

  try {
    if (id) await api.patch(`/job-positions/${id}`, { name });
    else await api.post('/job-positions', { name });
  } catch (err) {
    return { error: toMessage(err, 'Failed to save position.') };
  }

  revalidatePath('/config/positions');
  return { success: 'Position saved.' };
}

export async function deletePositionAction(id: string): Promise<void> {
  await api.delete(`/job-positions/${id}`);
  revalidatePath('/config/positions');
}

// ---------------------------------------------------------------- Users

export async function saveUserAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const password = str(form, 'password');

  const payload = {
    email: str(form, 'email'),
    name: str(form, 'name'),
    role: str(form, 'role'),
    active: bool(form, 'active'),
    employeeId: str(form, 'employeeId') ?? null,
    ...(password ? { password } : {}),
  };

  if (!payload.email || !payload.name || !payload.role) {
    return { error: 'Name, email and role are required.' };
  }
  if (!id && !password) return { error: 'A password is required for a new user.' };

  try {
    if (id) await api.patch(`/users/${id}`, payload);
    else await api.post('/users', payload);
  } catch (err) {
    return { error: toMessage(err, 'Failed to save user.') };
  }

  revalidatePath('/config/users');
  return { success: 'User saved.' };
}

export async function deleteUserAction(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
  revalidatePath('/config/users');
}
