import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader, Tabs, AlertBanner } from '@/components/ui';
import { UsersManager } from './users-manager';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'users', 'read')) redirect('/dashboard');

  const [users, employees] = await Promise.all([
    prisma.user.findMany({
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }),
    prisma.employee.findMany({
      where: { status: { not: 'INACTIVE' } },
      select: { id: true, firstName: true, lastName: true, userId: true },
      orderBy: { firstName: 'asc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle="Platform accounts and their permission level. Linking a user to an employee enables self-service."
      />

      <Tabs
        active="/config/users"
        tabs={[
          { label: 'Working Schedules', href: '/config/schedules' },
          { label: 'Departments', href: '/config/departments' },
          { label: 'Job Positions', href: '/config/positions' },
          { label: 'Users & Roles', href: '/config/users' },
        ]}
      />

      <div className="mb-5">
        <AlertBanner
          tone="info"
          title="Role capabilities"
          items={[
            'Employee — own records only; can file attendance and time off requests.',
            'HR Manager — full CRUD on employees, contracts, attendance, schedules and time off; approves leave; no payroll access.',
            'HR Payroll User — HR Manager plus create/read/update on pay runs and payslips; read-only salary configuration.',
            'HR Payroll Manager — full control of pay runs, payslips, salary structures and rules.',
            'Admin — everything, including user management.',
          ]}
        />
      </div>

      <UsersManager
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          employeeId: u.employee?.id ?? null,
          employeeName: u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : null,
        }))}
        employees={employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          linked: Boolean(e.userId),
        }))}
        currentUserId={session.userId}
        canManage={can(session.role, 'users', 'create')}
        canDelete={can(session.role, 'users', 'delete')}
      />
    </>
  );
}
