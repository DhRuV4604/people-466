'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { computeWeeklyHours, type ScheduleLineInput } from '@/lib/schedule';
import { ROLES, type Role } from '@/lib/rbac';

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

function bool(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

// ------------------------------------------------------------------ Working schedules

/** Parse the repeating day/start/end/break rows posted by the schedule form. */
function parseScheduleLines(form: FormData): ScheduleLineInput[] {
  const days = form.getAll('lineDay').map(String);
  const starts = form.getAll('lineStart').map(String);
  const ends = form.getAll('lineEnd').map(String);
  const breaks = form.getAll('lineBreak').map(String);

  const lines: ScheduleLineInput[] = [];
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
  await requirePermission('workingSchedules', id ? 'update' : 'create');

  const name = str(form, 'name');
  if (!name) return { error: 'Schedule name is required.' };

  const lines = parseScheduleLines(form);
  if (lines.length === 0) {
    return { error: 'Add at least one working day with a start and end time.' };
  }

  // Weekly hours are always derived, never accepted from the client (spec A3).
  const hoursPerWeek = computeWeeklyHours(lines);

  const data = {
    name,
    scheduleType: str(form, 'scheduleType') ?? 'FULL_TIME',
    timezone: str(form, 'timezone') ?? 'UTC',
    hoursPerWeek,
    active: bool(form, 'active'),
  };

  let scheduleId = id;
  try {
    if (id) {
      await prisma.workingSchedule.update({ where: { id }, data });
      // Replace the whole pattern so removed rows disappear.
      await prisma.workingScheduleLine.deleteMany({ where: { scheduleId: id } });
      await prisma.workingScheduleLine.createMany({
        data: lines.map((l) => ({ ...l, scheduleId: id })),
      });
    } else {
      const created = await prisma.workingSchedule.create({
        data: { ...data, lines: { create: lines } },
      });
      scheduleId = created.id;
    }
  } catch (err) {
    return {
      error:
        err instanceof Error && err.message.includes('Unique')
          ? 'A schedule with this name already exists.'
          : 'Failed to save schedule.',
    };
  }

  revalidatePath('/config/schedules');
  if (!id) redirect(`/config/schedules/${scheduleId}`);
  return { success: `Schedule saved — ${hoursPerWeek} hours per week.` };
}

export async function deleteScheduleAction(id: string): Promise<void> {
  await requirePermission('workingSchedules', 'delete');

  const inUse =
    (await prisma.employee.count({ where: { workingScheduleId: id } })) +
    (await prisma.contract.count({ where: { workingScheduleId: id } }));

  if (inUse > 0) {
    throw new Error(`${inUse} employee(s) or contract(s) still use this schedule.`);
  }

  await prisma.workingSchedule.delete({ where: { id } });
  revalidatePath('/config/schedules');
  redirect('/config/schedules');
}

// ------------------------------------------------------------------ Departments

export async function saveDepartmentAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  await requirePermission('employees', id ? 'update' : 'create');

  const name = str(form, 'name');
  if (!name) return { error: 'Department name is required.' };

  const data = { name, code: str(form, 'code') };

  try {
    if (id) await prisma.department.update({ where: { id }, data });
    else await prisma.department.create({ data });
  } catch {
    return { error: 'A department with this name already exists.' };
  }

  revalidatePath('/config/departments');
  return { success: 'Department saved.' };
}

export async function deleteDepartmentAction(id: string): Promise<void> {
  await requirePermission('employees', 'delete');

  const count = await prisma.employee.count({ where: { departmentId: id } });
  if (count > 0) throw new Error(`${count} employee(s) are still assigned to this department.`);

  await prisma.department.delete({ where: { id } });
  revalidatePath('/config/departments');
}

// ------------------------------------------------------------------ Job positions

export async function savePositionAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  await requirePermission('employees', id ? 'update' : 'create');

  const name = str(form, 'name');
  if (!name) return { error: 'Position name is required.' };

  try {
    if (id) await prisma.jobPosition.update({ where: { id }, data: { name } });
    else await prisma.jobPosition.create({ data: { name } });
  } catch {
    return { error: 'A position with this name already exists.' };
  }

  revalidatePath('/config/positions');
  return { success: 'Position saved.' };
}

export async function deletePositionAction(id: string): Promise<void> {
  await requirePermission('employees', 'delete');

  const count = await prisma.employee.count({ where: { jobPositionId: id } });
  if (count > 0) throw new Error(`${count} employee(s) still hold this position.`);

  await prisma.jobPosition.delete({ where: { id } });
  revalidatePath('/config/positions');
}

// ------------------------------------------------------------------ Users & roles

export async function saveUserAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  await requirePermission('users', id ? 'update' : 'create');

  const email = str(form, 'email')?.toLowerCase();
  const name = str(form, 'name');
  const role = str(form, 'role');
  const password = str(form, 'password');

  if (!email || !name || !role) return { error: 'Name, email and role are required.' };
  if (!ROLES.includes(role as Role)) return { error: 'Unknown role.' };
  if (!id && !password) return { error: 'A password is required for a new user.' };
  if (password && password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const employeeId = str(form, 'employeeId');

  try {
    if (id) {
      await prisma.user.update({
        where: { id },
        data: {
          email,
          name,
          role,
          active: bool(form, 'active'),
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      });
      // Re-point the employee link, clearing any previous one.
      await prisma.employee.updateMany({ where: { userId: id }, data: { userId: null } });
      if (employeeId) {
        await prisma.employee.update({ where: { id: employeeId }, data: { userId: id } });
      }
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          name,
          role,
          active: bool(form, 'active'),
          passwordHash: await hashPassword(password!),
        },
      });
      if (employeeId) {
        await prisma.employee.update({ where: { id: employeeId }, data: { userId: created.id } });
      }
    }
  } catch (err) {
    return {
      error:
        err instanceof Error && err.message.includes('Unique')
          ? 'A user with this email already exists.'
          : 'Failed to save user.',
    };
  }

  revalidatePath('/config/users');
  return { success: 'User saved.' };
}

export async function deleteUserAction(id: string): Promise<void> {
  const session = await requirePermission('users', 'delete');
  if (session.userId === id) throw new Error('You cannot delete your own account.');

  await prisma.employee.updateMany({ where: { userId: id }, data: { userId: null } });
  await prisma.user.delete({ where: { id } });
  revalidatePath('/config/users');
}
