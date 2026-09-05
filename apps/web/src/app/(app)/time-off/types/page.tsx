import { redirect } from 'next/navigation';
import { can, type TimeOffTypeDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { PageHeader, Tabs, EmptyState } from '@/components/ui';
import { TimeOffTypesManager } from './types-manager';

export const dynamic = 'force-dynamic';

export default async function TimeOffTypesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const types = await apiGet<TimeOffTypeDto[]>('/time-off/types');
  const canManage = can(session.role, 'timeOffTypes', 'create');

  return (
    <>
      <PageHeader
        title="Time Off Types"
        subtitle="Leave policies: units, allocation requirements, approval workflow and payroll treatment."
      />

      <Tabs
        active="/time-off/types"
        tabs={[
          { label: 'Requests', href: '/time-off/requests' },
          { label: 'Allocations', href: '/time-off/allocations' },
          { label: 'Time Off Types', href: '/time-off/types' },
        ]}
      />

      {types.length === 0 && !canManage ? (
        <EmptyState title="No time off types configured" />
      ) : (
        <TimeOffTypesManager
          types={types.map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            unit: t.unit,
            requiresAllocation: t.requiresAllocation,
            requiresApproval: t.requiresApproval,
            paid: t.paid,
            colorHex: t.colorHex,
            maxDaysPerRequest: t.maxDaysPerRequest,
            active: t.active,
            requestCount: t.requestCount ?? 0,
            allocationCount: t.allocationCount ?? 0,
          }))}
          canManage={canManage}
          canDelete={can(session.role, 'timeOffTypes', 'delete')}
        />
      )}
    </>
  );
}
