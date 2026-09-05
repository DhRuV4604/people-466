import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { AttendanceForm } from '@/components/attendance-form';
import { createAttendanceAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'attendance', 'create')) redirect('/attendance');

  const params = await searchParams;

  // Employees can only file their own entries, so the picker is locked.
  const lockedEmployeeId = session.role === 'EMPLOYEE' ? session.employeeId : params.employee;

  const employees =
    session.role === 'EMPLOYEE'
      ? []
      : await prisma.employee.findMany({
          where: { status: { not: 'INACTIVE' } },
          select: { id: true, firstName: true, lastName: true },
          orderBy: { firstName: 'asc' },
        });

  return (
    <>
      <PageHeader
        title="New Attendance Entry"
        subtitle="Record a check-in and optional check-out; hours are derived from the working schedule."
        breadcrumb={[
          { label: 'Attendance', href: '/attendance' },
          { label: 'New', href: '/attendance/new' },
        ]}
      />

      <AttendanceForm
        action={createAttendanceAction}
        record={lockedEmployeeId ? { employeeId: lockedEmployeeId } : undefined}
        employees={employees}
        submitLabel="Create Entry"
        cancelHref={params.employee ? `/attendance?employee=${params.employee}` : '/attendance'}
        lockEmployee={Boolean(lockedEmployeeId)}
      />
    </>
  );
}
