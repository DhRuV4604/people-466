'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireSession } from '@/lib/auth';
import { computeAttendance } from '@/lib/attendance';

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

async function scheduleLinesFor(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { workingSchedule: { include: { lines: true } } },
  });
  return employee?.workingSchedule?.lines ?? [];
}

export async function createAttendanceAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const session = await requirePermission('attendance', 'create');

  // Employees may only record their own attendance.
  const requestedEmployeeId = str(form, 'employeeId');
  const employeeId =
    session.role === 'EMPLOYEE' ? session.employeeId : requestedEmployeeId;

  if (!employeeId) return { error: 'Employee is required.' };
  if (session.role === 'EMPLOYEE' && requestedEmployeeId && requestedEmployeeId !== session.employeeId) {
    return { error: 'You can only record your own attendance.' };
  }

  const checkInRaw = str(form, 'checkIn');
  if (!checkInRaw) return { error: 'Check-in time is required.' };

  const checkIn = new Date(checkInRaw);
  const checkOutRaw = str(form, 'checkOut');
  const checkOut = checkOutRaw ? new Date(checkOutRaw) : null;

  if (checkOut && checkOut <= checkIn) {
    return { error: 'Check-out must be after check-in.' };
  }

  // Block a second open or overlapping entry for the same shift.
  const overlapping = await prisma.attendance.findFirst({
    where: {
      employeeId,
      checkIn: { lte: checkOut ?? checkIn },
      OR: [{ checkOut: null }, { checkOut: { gte: checkIn } }],
    },
  });
  if (overlapping) {
    return { error: 'An attendance record already overlaps this time range.' };
  }

  const lines = await scheduleLinesFor(employeeId);
  const computed = computeAttendance(checkIn, checkOut, lines);

  const record = await prisma.attendance.create({
    data: {
      employeeId,
      checkIn,
      checkOut,
      ...computed,
      notes: str(form, 'notes'),
    },
  });

  revalidatePath('/attendance');
  redirect(`/attendance/${record.id}`);
}

export async function updateAttendanceAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  // Manual corrections are restricted to users who may update attendance (spec B3).
  const session = await requirePermission('attendance', 'update');

  const id = str(form, 'id');
  if (!id) return { error: 'Missing attendance id.' };

  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) return { error: 'Attendance record not found.' };

  const checkInRaw = str(form, 'checkIn');
  if (!checkInRaw) return { error: 'Check-in time is required.' };

  const checkIn = new Date(checkInRaw);
  const checkOutRaw = str(form, 'checkOut');
  const checkOut = checkOutRaw ? new Date(checkOutRaw) : null;

  if (checkOut && checkOut <= checkIn) {
    return { error: 'Check-out must be after check-in.' };
  }

  const lines = await scheduleLinesFor(existing.employeeId);
  const computed = computeAttendance(checkIn, checkOut, lines);

  // An explicit status override wins over the derived one, but is still audited.
  const statusOverride = str(form, 'status');
  const timesChanged =
    existing.checkIn.getTime() !== checkIn.getTime() ||
    (existing.checkOut?.getTime() ?? null) !== (checkOut?.getTime() ?? null);

  await prisma.attendance.update({
    where: { id },
    data: {
      checkIn,
      checkOut,
      workedHours: computed.workedHours,
      overtimeHours: computed.overtimeHours,
      status: statusOverride ?? computed.status,
      notes: str(form, 'notes'),
      manuallyEdited: existing.manuallyEdited || timesChanged || Boolean(statusOverride),
      editedById: session.userId,
      editedAt: new Date(),
      editReason: str(form, 'editReason'),
    },
  });

  revalidatePath('/attendance');
  revalidatePath(`/attendance/${id}`);
  return { success: 'Attendance record updated.' };
}

export async function deleteAttendanceAction(id: string): Promise<void> {
  await requirePermission('attendance', 'delete');
  await prisma.attendance.delete({ where: { id } });
  revalidatePath('/attendance');
  redirect('/attendance');
}

/** One-click check-in for the signed-in employee. */
export async function checkInAction(): Promise<void> {
  const session = await requireSession();
  if (!session.employeeId) throw new Error('No employee record linked to this account.');

  const open = await prisma.attendance.findFirst({
    where: { employeeId: session.employeeId, checkOut: null },
  });
  if (open) throw new Error('You already have an open check-in.');

  const lines = await scheduleLinesFor(session.employeeId);
  const now = new Date();
  const computed = computeAttendance(now, null, lines);

  await prisma.attendance.create({
    data: { employeeId: session.employeeId, checkIn: now, ...computed },
  });

  revalidatePath('/my-space');
  revalidatePath('/attendance');
}

/** Close the signed-in employee's open attendance entry. */
export async function checkOutAction(): Promise<void> {
  const session = await requireSession();
  if (!session.employeeId) throw new Error('No employee record linked to this account.');

  const open = await prisma.attendance.findFirst({
    where: { employeeId: session.employeeId, checkOut: null },
    orderBy: { checkIn: 'desc' },
  });
  if (!open) throw new Error('No open check-in to close.');

  const lines = await scheduleLinesFor(session.employeeId);
  const now = new Date();
  const computed = computeAttendance(open.checkIn, now, lines);

  await prisma.attendance.update({
    where: { id: open.id },
    data: { checkOut: now, ...computed },
  });

  revalidatePath('/my-space');
  revalidatePath('/attendance');
}
