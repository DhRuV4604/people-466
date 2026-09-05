import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getLeaveBalances } from '@/lib/timeoff';
import { PageHeader } from '@/components/ui';
import { LeaveRequestForm } from '@/components/leave-request-form';
import { saveLeaveRequestAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewLeaveRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffRequests', 'create')) redirect('/time-off/requests');

  const params = await searchParams;
  const lockedEmployeeId = session.role === 'EMPLOYEE' ? session.employeeId : params.employee;

  const [types, employees, balances] = await Promise.all([
    prisma.timeOffType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    session.role === 'EMPLOYEE'
      ? Promise.resolve([])
      : prisma.employee.findMany({
          where: { status: { not: 'INACTIVE' } },
          select: { id: true, firstName: true, lastName: true },
          orderBy: { firstName: 'asc' },
        }),
    lockedEmployeeId ? getLeaveBalances(lockedEmployeeId) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="New Time Off Request"
        subtitle="Duration is calculated from the employee's working schedule, and allocation-backed types are checked against the remaining balance."
        breadcrumb={[
          { label: 'Time Off', href: '/time-off/requests' },
          { label: 'New Request', href: '/time-off/requests/new' },
        ]}
      />

      <LeaveRequestForm
        action={saveLeaveRequestAction}
        request={lockedEmployeeId ? { employeeId: lockedEmployeeId } : undefined}
        employees={employees}
        types={types}
        balances={balances.map((b) => ({
          typeId: b.typeId,
          remaining: b.remaining,
          allocated: b.allocated,
          unit: b.unit,
        }))}
        submitLabel="Submit Request"
        cancelHref="/time-off/requests"
        lockEmployee={Boolean(lockedEmployeeId)}
      />
    </>
  );
}
