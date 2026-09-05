import { redirect } from 'next/navigation';
import { can, type DepartmentDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { PageHeader, Tabs } from '@/components/ui';
import { SimpleEntityManager } from '../entity-manager';
import { saveDepartmentAction, deleteDepartmentAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const departments = await apiGet<DepartmentDto[]>('/departments');

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Organisational units used across HR and payroll reporting."
      />

      <Tabs
        active="/config/departments"
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
        entityLabel="Department"
        showCode
        items={departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          usageCount: d.employeeCount ?? 0,
          usageLabel: 'employee(s)',
        }))}
        canManage={can(session.role, 'employees', 'create')}
        canDelete={can(session.role, 'employees', 'delete')}
        saveAction={saveDepartmentAction}
        deleteAction={deleteDepartmentAction}
      />
    </>
  );
}
