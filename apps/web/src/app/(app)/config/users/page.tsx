import { redirect } from 'next/navigation';
import { can, type Role, type EmployeeSummaryDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGetOrRedirect } from '@/lib/api-client';
import { PageHeader, Tabs, AlertBanner } from '@/components/ui';
import { UsersManager } from './users-manager';

export const dynamic = 'force-dynamic';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  employeeId: string | null;
  employeeName: string | null;
}

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [users, employees] = await Promise.all([
    apiGetOrRedirect<ApiUser[]>('/users', '/my-space'),
    apiGetOrRedirect<EmployeeSummaryDto[]>('/employees', '/my-space'),
  ]);

  // An employee is available to link when no other user already claims them.
  const linkedIds = new Set(users.map((u) => u.employeeId).filter(Boolean));

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
        users={users}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.fullName,
          linked: linkedIds.has(e.id),
        }))}
        currentUserId={session.id}
        canManage={can(session.role, 'users', 'create')}
        canDelete={can(session.role, 'users', 'delete')}
      />
    </>
  );
}
