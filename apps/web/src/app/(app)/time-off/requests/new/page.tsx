import { redirect } from 'next/navigation';
import {
  can,
  type TimeOffTypeDto,
  type LeaveBalanceDto,
  type EmployeeSummaryDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
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
    apiGet<TimeOffTypeDto[]>('/time-off/types'),
    session.role === 'EMPLOYEE'
      ? Promise.resolve([] as EmployeeSummaryDto[])
      : apiGet<EmployeeSummaryDto[]>('/employees', { status: 'ACTIVE' }),
    lockedEmployeeId
      ? apiGet<LeaveBalanceDto[]>(`/time-off/balances/${lockedEmployeeId}`)
      : Promise.resolve([] as LeaveBalanceDto[]),
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
        types={types.filter((t) => t.active)}
        balances={balances}
        submitLabel="Submit Request"
        cancelHref="/time-off/requests"
        lockEmployee={Boolean(lockedEmployeeId)}
      />
    </>
  );
}
