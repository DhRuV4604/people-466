import { redirect } from 'next/navigation';
import { can, type JobPositionDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { PageHeader, Tabs } from '@/components/ui';
import { SimpleEntityManager } from '../entity-manager';
import { savePositionAction, deletePositionAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function PositionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const positions = await apiGet<JobPositionDto[]>('/job-positions');

  return (
    <>
      <PageHeader
        title="Job Positions"
        subtitle="Roles assignable to employees and contracts."
      />

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
          usageCount: p.employeeCount ?? 0,
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
