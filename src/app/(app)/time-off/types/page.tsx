import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader, Tabs, EmptyState } from '@/components/ui';
import { TimeOffTypesManager } from './types-manager';

export const dynamic = 'force-dynamic';

export default async function TimeOffTypesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffTypes', 'read')) redirect('/my-space');

  const types = await prisma.timeOffType.findMany({
    include: {
      _count: { select: { requests: true, allocations: true } },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

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
            requestCount: t._count.requests,
            allocationCount: t._count.allocations,
          }))}
          canManage={canManage}
          canDelete={can(session.role, 'timeOffTypes', 'delete')}
        />
      )}
    </>
  );
}
