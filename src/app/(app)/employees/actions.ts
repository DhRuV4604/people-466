'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

export interface ActionState {
  error?: string;
  success?: string;
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function dateOrNull(form: FormData, key: string): Date | null {
  const value = str(form, key);
  return value ? new Date(value) : null;
}

async function nextEmployeeCode(): Promise<string> {
  const last = await prisma.employee.findFirst({
    orderBy: { employeeCode: 'desc' },
    select: { employeeCode: true },
  });
  const n = last ? parseInt(last.employeeCode.replace(/\D/g, ''), 10) + 1 : 1;
  return `EMP${String(n).padStart(4, '0')}`;
}

export async function createEmployeeAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  await requirePermission('employees', 'create');

  const firstName = str(form, 'firstName');
  const lastName = str(form, 'lastName');
  const workEmail = str(form, 'workEmail');
  const hireDate = dateOrNull(form, 'hireDate');

  if (!firstName || !lastName || !workEmail || !hireDate) {
    return { error: 'First name, last name, work email and hire date are required.' };
  }

  const existing = await prisma.employee.findUnique({ where: { workEmail } });
  if (existing) return { error: `An employee already uses ${workEmail}.` };

  let employee;
  try {
    employee = await prisma.employee.create({
      data: {
        employeeCode: await nextEmployeeCode(),
        firstName,
        lastName,
        workEmail,
        workPhone: str(form, 'workPhone'),
        dateOfBirth: dateOrNull(form, 'dateOfBirth'),
        gender: str(form, 'gender'),
        address: str(form, 'address'),
        bankName: str(form, 'bankName'),
        bankAccountNumber: str(form, 'bankAccountNumber'),
        employeeType: str(form, 'employeeType') ?? 'FULL_TIME',
        status: str(form, 'status') ?? 'ACTIVE',
        hireDate,
        departmentId: str(form, 'departmentId'),
        jobPositionId: str(form, 'jobPositionId'),
        managerId: str(form, 'managerId'),
        workingScheduleId: str(form, 'workingScheduleId'),
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create employee.' };
  }

  revalidatePath('/employees');
  redirect(`/employees/${employee.id}`);
}

export async function updateEmployeeAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  await requirePermission('employees', 'update');

  const id = str(form, 'id');
  if (!id) return { error: 'Missing employee id.' };

  const firstName = str(form, 'firstName');
  const lastName = str(form, 'lastName');
  const workEmail = str(form, 'workEmail');
  const hireDate = dateOrNull(form, 'hireDate');

  if (!firstName || !lastName || !workEmail || !hireDate) {
    return { error: 'First name, last name, work email and hire date are required.' };
  }

  // Guard against an employee reporting to themselves.
  const managerId = str(form, 'managerId');
  if (managerId === id) return { error: 'An employee cannot be their own manager.' };

  try {
    await prisma.employee.update({
      where: { id },
      data: {
        firstName,
        lastName,
        workEmail,
        workPhone: str(form, 'workPhone'),
        dateOfBirth: dateOrNull(form, 'dateOfBirth'),
        gender: str(form, 'gender'),
        address: str(form, 'address'),
        bankName: str(form, 'bankName'),
        bankAccountNumber: str(form, 'bankAccountNumber'),
        employeeType: str(form, 'employeeType') ?? 'FULL_TIME',
        status: str(form, 'status') ?? 'ACTIVE',
        hireDate,
        exitDate: dateOrNull(form, 'exitDate'),
        departmentId: str(form, 'departmentId'),
        jobPositionId: str(form, 'jobPositionId'),
        managerId,
        workingScheduleId: str(form, 'workingScheduleId'),
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update employee.' };
  }

  revalidatePath('/employees');
  revalidatePath(`/employees/${id}`);
  return { success: 'Employee saved.' };
}

export async function deleteEmployeeAction(id: string): Promise<void> {
  await requirePermission('employees', 'delete');

  // Payroll history must not be silently destroyed; archive instead.
  const payslipCount = await prisma.payslip.count({ where: { employeeId: id } });
  if (payslipCount > 0) {
    await prisma.employee.update({
      where: { id },
      data: { status: 'INACTIVE', exitDate: new Date() },
    });
  } else {
    await prisma.employee.delete({ where: { id } });
  }

  revalidatePath('/employees');
  redirect('/employees');
}
