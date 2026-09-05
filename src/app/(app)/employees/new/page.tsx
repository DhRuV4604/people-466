import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { EmployeeForm } from '@/components/employee-form';
import { createEmployeeAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewEmployeePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'employees', 'create')) redirect('/employees');

  const [departments, positions, managers, schedules] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.jobPosition.findMany({ orderBy: { name: 'asc' } }),
    prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.workingSchedule.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <>
      <PageHeader
        title="New Employee"
        subtitle="Create an employee record; contracts and schedules can be attached afterwards."
        breadcrumb={[
          { label: 'Employees', href: '/employees' },
          { label: 'New', href: '/employees/new' },
        ]}
      />

      <EmployeeForm
        action={createEmployeeAction}
        departments={departments}
        positions={positions}
        managers={managers}
        schedules={schedules}
        submitLabel="Create Employee"
        cancelHref="/employees"
      />
    </>
  );
}
