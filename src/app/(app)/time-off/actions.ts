'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireSession } from '@/lib/auth';
import { computeLeaveDuration, validateLeaveRequest, findConsumableAllocation } from '@/lib/timeoff';

export interface ActionState {
  error?: string;
  success?: string;
  warnings?: string[];
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

function bool(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

// ------------------------------------------------------------------ Time off types

export async function saveTimeOffTypeAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  await requirePermission('timeOffTypes', id ? 'update' : 'create');

  const name = str(form, 'name');
  const code = str(form, 'code');
  if (!name || !code) return { error: 'Name and code are required.' };

  const data = {
    name,
    code: code.toUpperCase(),
    unit: str(form, 'unit') ?? 'DAY',
    requiresAllocation: bool(form, 'requiresAllocation'),
    requiresApproval: bool(form, 'requiresApproval'),
    paid: bool(form, 'paid'),
    colorHex: str(form, 'colorHex') ?? '#2563eb',
    maxDaysPerRequest: num(form, 'maxDaysPerRequest'),
    active: bool(form, 'active'),
  };

  try {
    if (id) await prisma.timeOffType.update({ where: { id }, data });
    else await prisma.timeOffType.create({ data });
  } catch (err) {
    return {
      error:
        err instanceof Error && err.message.includes('Unique')
          ? 'A time off type with this name or code already exists.'
          : 'Failed to save time off type.',
    };
  }

  revalidatePath('/time-off/types');
  return { success: 'Time off type saved.' };
}

export async function deleteTimeOffTypeAction(id: string): Promise<void> {
  await requirePermission('timeOffTypes', 'delete');

  const inUse = await prisma.leaveRequest.count({ where: { typeId: id } });
  // Types with history are archived so existing requests keep their label.
  if (inUse > 0) await prisma.timeOffType.update({ where: { id }, data: { active: false } });
  else await prisma.timeOffType.delete({ where: { id } });

  revalidatePath('/time-off/types');
}

// ------------------------------------------------------------------ Allocations

export async function saveAllocationAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  await requirePermission('timeOffAllocations', id ? 'update' : 'create');

  const employeeId = str(form, 'employeeId');
  const typeId = str(form, 'typeId');
  const quantity = num(form, 'quantity');
  const validFromRaw = str(form, 'validFrom');

  if (!employeeId || !typeId || quantity === null || !validFromRaw) {
    return { error: 'Employee, type, quantity and valid-from date are required.' };
  }
  if (quantity <= 0) return { error: 'Quantity must be greater than zero.' };

  const validFrom = new Date(validFromRaw);
  const validToRaw = str(form, 'validTo');
  const validTo = validToRaw ? new Date(validToRaw) : null;

  if (validTo && validTo < validFrom) {
    return { error: 'Valid-to date cannot be before the valid-from date.' };
  }

  // Reducing an allocation below what has already been consumed would create a
  // negative balance, so block it.
  if (id) {
    const consumed = await prisma.leaveRequest.aggregate({
      where: { allocationId: id, status: 'APPROVED' },
      _sum: { duration: true },
    });
    const used = consumed._sum.duration ?? 0;
    if (quantity < used) {
      return { error: `${used} day(s) are already approved against this allocation.` };
    }
  }

  const status = str(form, 'status') ?? 'DRAFT';

  const data = {
    employeeId,
    typeId,
    quantity,
    validFrom,
    validTo,
    status,
    notes: str(form, 'notes'),
    ...(status === 'APPROVED' ? { approvedAt: new Date() } : {}),
  };

  let allocationId = id;
  try {
    if (id) await prisma.leaveAllocation.update({ where: { id }, data });
    else {
      const created = await prisma.leaveAllocation.create({ data });
      allocationId = created.id;
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save allocation.' };
  }

  revalidatePath('/time-off/allocations');
  if (!id) redirect(`/time-off/allocations/${allocationId}`);
  return { success: 'Allocation saved.' };
}

export async function approveAllocationAction(id: string): Promise<void> {
  const session = await requirePermission('timeOffAllocations', 'approve');

  await prisma.leaveAllocation.update({
    where: { id },
    data: { status: 'APPROVED', approvedBy: session.name, approvedAt: new Date() },
  });

  revalidatePath('/time-off/allocations');
  revalidatePath(`/time-off/allocations/${id}`);
}

export async function refuseAllocationAction(id: string): Promise<void> {
  await requirePermission('timeOffAllocations', 'approve');

  await prisma.leaveAllocation.update({ where: { id }, data: { status: 'REFUSED' } });

  revalidatePath('/time-off/allocations');
  revalidatePath(`/time-off/allocations/${id}`);
}

export async function deleteAllocationAction(id: string): Promise<void> {
  await requirePermission('timeOffAllocations', 'delete');

  const consumed = await prisma.leaveRequest.count({
    where: { allocationId: id, status: 'APPROVED' },
  });
  if (consumed > 0) {
    throw new Error('Approved leave has already consumed this allocation.');
  }

  await prisma.leaveAllocation.delete({ where: { id } });
  revalidatePath('/time-off/allocations');
  redirect('/time-off/allocations');
}

// ------------------------------------------------------------------ Requests

export async function saveLeaveRequestAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  const session = await requirePermission('timeOffRequests', id ? 'update' : 'create');

  const requestedEmployeeId = str(form, 'employeeId');
  const employeeId = session.role === 'EMPLOYEE' ? session.employeeId : requestedEmployeeId;

  if (!employeeId) return { error: 'Employee is required.' };
  if (
    session.role === 'EMPLOYEE' &&
    requestedEmployeeId &&
    requestedEmployeeId !== session.employeeId
  ) {
    return { error: 'You can only file your own time off requests.' };
  }

  const typeId = str(form, 'typeId');
  const dateFromRaw = str(form, 'dateFrom');
  const dateToRaw = str(form, 'dateTo');

  if (!typeId || !dateFromRaw || !dateToRaw) {
    return { error: 'Type, start date and end date are required.' };
  }

  const dateFrom = new Date(dateFromRaw);
  const dateTo = new Date(dateToRaw);

  const [type, employee] = await Promise.all([
    prisma.timeOffType.findUnique({ where: { id: typeId } }),
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: { workingSchedule: { include: { lines: true } } },
    }),
  ]);

  if (!type || !employee) return { error: 'Employee or time off type not found.' };

  // Duration counts scheduled working days only.
  const duration = computeLeaveDuration(
    dateFrom,
    dateTo,
    employee.workingSchedule?.lines ?? [],
    type.unit as 'DAY' | 'HOUR'
  );

  const validation = await validateLeaveRequest({
    employeeId,
    typeId,
    dateFrom,
    dateTo,
    duration,
    excludeRequestId: id ?? undefined,
  });

  if (!validation.ok) return { error: validation.errors.join(' ') };

  const data = {
    employeeId,
    typeId,
    dateFrom,
    dateTo,
    duration,
    reason: str(form, 'reason'),
    // A type that needs no approval is granted immediately.
    status: type.requiresApproval ? 'TO_APPROVE' : 'APPROVED',
    ...(type.requiresApproval ? {} : { approvedBy: 'Auto', approvedAt: new Date() }),
    ...(type.requiresAllocation && !type.requiresApproval
      ? { allocationId: validation.allocationId }
      : {}),
  };

  let requestId = id;
  try {
    if (id) {
      const existing = await prisma.leaveRequest.findUnique({ where: { id } });
      if (existing && existing.status === 'APPROVED' && session.role === 'EMPLOYEE') {
        return { error: 'An approved request can no longer be edited.' };
      }
      await prisma.leaveRequest.update({ where: { id }, data });
    } else {
      const created = await prisma.leaveRequest.create({ data });
      requestId = created.id;
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save request.' };
  }

  revalidatePath('/time-off/requests');
  if (!id) redirect(`/time-off/requests/${requestId}`);
  return { success: 'Request saved.', warnings: validation.warnings };
}

/**
 * Approving links the request to a consumable allocation so the balance is
 * visibly drawn down rather than merely inferred (spec A4/B4).
 */
export async function approveLeaveRequestAction(id: string): Promise<void> {
  const session = await requirePermission('timeOffRequests', 'approve');

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { type: true },
  });
  if (!request) throw new Error('Request not found.');

  const validation = await validateLeaveRequest({
    employeeId: request.employeeId,
    typeId: request.typeId,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    duration: request.duration,
    excludeRequestId: id,
  });

  if (!validation.ok) throw new Error(validation.errors.join(' '));

  let allocationId = request.allocationId;
  if (request.type.requiresAllocation && !allocationId) {
    const allocation = await findConsumableAllocation(
      request.employeeId,
      request.typeId,
      request.dateFrom
    );
    if (!allocation) throw new Error('No approved allocation is available to consume.');
    allocationId = allocation.id;
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      allocationId,
      approvedBy: session.name,
      approvedAt: new Date(),
      refusedBy: null,
      refusedAt: null,
      refuseReason: null,
    },
  });

  revalidatePath('/time-off/requests');
  revalidatePath(`/time-off/requests/${id}`);
}

export async function refuseLeaveRequestAction(id: string, reason: string): Promise<void> {
  const session = await requirePermission('timeOffRequests', 'approve');

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'REFUSED',
      // Release the allocation so the balance returns to the employee.
      allocationId: null,
      refusedBy: session.name,
      refusedAt: new Date(),
      refuseReason: reason || 'No reason provided.',
      approvedBy: null,
      approvedAt: null,
    },
  });

  revalidatePath('/time-off/requests');
  revalidatePath(`/time-off/requests/${id}`);
}

export async function cancelLeaveRequestAction(id: string): Promise<void> {
  const session = await requireSession();

  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) throw new Error('Request not found.');

  // An employee may withdraw only their own request.
  if (session.role === 'EMPLOYEE' && request.employeeId !== session.employeeId) {
    throw new Error('You can only cancel your own requests.');
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: 'CANCELLED', allocationId: null },
  });

  revalidatePath('/time-off/requests');
  revalidatePath(`/time-off/requests/${id}`);
}

export async function deleteLeaveRequestAction(id: string): Promise<void> {
  await requirePermission('timeOffRequests', 'delete');
  await prisma.leaveRequest.delete({ where: { id } });
  revalidatePath('/time-off/requests');
  redirect('/time-off/requests');
}
