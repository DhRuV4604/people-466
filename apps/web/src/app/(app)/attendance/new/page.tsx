import { redirect } from 'next/navigation';
import { can, type EmployeeSummaryDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
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
      : await apiGet<EmployeeSummaryDto[]>('/employees', { status: 'ACTIVE' });

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
