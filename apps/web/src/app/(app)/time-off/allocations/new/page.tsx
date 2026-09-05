import { redirect } from 'next/navigation';
import { can, type EmployeeSummaryDto, type TimeOffTypeDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { PageHeader } from '@/components/ui';
import { AllocationForm } from '@/components/allocation-form';
import { saveAllocationAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffAllocations', 'create')) redirect('/time-off/allocations');

  const params = await searchParams;

  const [employees, types] = await Promise.all([
    apiGet<EmployeeSummaryDto[]>('/employees', { status: 'ACTIVE' }),
    apiGet<TimeOffTypeDto[]>('/time-off/types'),
  ]);

  const now = new Date();

  return (
    <>
      <PageHeader
        title="New Leave Allocation"
        subtitle="Grant a leave balance an employee can draw from; requests consume it once approved."
        breadcrumb={[
          { label: 'Allocations', href: '/time-off/allocations' },
          { label: 'New', href: '/time-off/allocations/new' },
        ]}
      />

      <AllocationForm
        action={saveAllocationAction}
        allocation={{
          employeeId: params.employee,
          validFrom: new Date(now.getFullYear(), 0, 1).toISOString(),
          validTo: new Date(now.getFullYear(), 11, 31).toISOString(),
        }}
        employees={employees}
        types={types.filter((t) => t.active && t.requiresAllocation)}
        submitLabel="Create Allocation"
        cancelHref="/time-off/allocations"
        lockEmployee={Boolean(params.employee)}
      />
    </>
  );
}
