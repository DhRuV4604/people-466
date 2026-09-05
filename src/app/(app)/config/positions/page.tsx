import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader, Tabs } from '@/components/ui';
import { SimpleEntityManager } from '../entity-manager';
import { savePositionAction, deletePositionAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function PositionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'employees', 'read')) redirect('/dashboard');

  const positions = await prisma.jobPosition.findMany({
    include: { _count: { select: { employees: true, contracts: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <>
      <PageHeader title="Job Positions" subtitle="Roles assignable to employees and contracts." />

      <Tabs
        active="/config/positions"
        tabs={[
          { label: 'Working Schedules', href: '/config/schedules' },
          { label: 'Departments', href: '/config/departments' },
          { label: 'Job Positions', href: '/config/positions' },
          ...(can(session.role, 'users', 'read')
            ? [{ label: 'Users & Roles', href: '/config/users' }]
            : []),
        ]}
      />

      <SimpleEntityManager
        entityLabel="Position"
        items={positions.map((p) => ({
          id: p.id,
          name: p.name,
          usageCount: p._count.employees,
          usageLabel: 'employee(s)',
        }))}
        canManage={can(session.role, 'employees', 'create')}
        canDelete={can(session.role, 'employees', 'delete')}
        saveAction={savePositionAction}
        deleteAction={deletePositionAction}
      />
    </>
  );
}
