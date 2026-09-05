import { redirect } from 'next/navigation';
import { can } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { TopNav, type NavItem } from '@/components/nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const role = session.role;

  // Navigation mirrors the specification, filtered to what the role may read.
  // This is presentation only - the API enforces the same matrix on every call.
  const items: NavItem[] = [];

  if (role === 'EMPLOYEE') {
    items.push({ label: 'My Space', href: '/my-space' });
  }
  if (can(role, 'dashboard', 'read')) {
    items.push({ label: 'Dashboard', href: '/dashboard' });
  }
  if (can(role, 'employees', 'read')) {
    items.push({ label: 'Employees', href: '/employees' });
  }
  if (can(role, 'contracts', 'read')) {
    items.push({ label: 'Contracts', href: '/contracts' });
  }
  if (can(role, 'attendance', 'read')) {
    items.push({ label: 'Attendance', href: '/attendance' });
  }
  if (can(role, 'timeOffRequests', 'read')) {
    items.push({
      label: 'Time Off',
      href: '/time-off',
      children: [
        { label: 'Requests', href: '/time-off/requests' },
        { label: 'Allocations', href: '/time-off/allocations' },
        { label: 'Time Off Types', href: '/time-off/types' },
      ],
    });
  }
  if (can(role, 'payruns', 'read') || can(role, 'salaryStructures', 'read')) {
    const children: { label: string; href: string }[] = [];
    if (can(role, 'payruns', 'read')) children.push({ label: 'Pay Runs', href: '/payroll/payruns' });
    if (can(role, 'payslips', 'read')) children.push({ label: 'Payslips', href: '/payroll/payslips' });
    if (can(role, 'salaryStructures', 'read'))
      children.push({ label: 'Salary Structures', href: '/payroll/structures' });
    if (can(role, 'salaryRules', 'read'))
      children.push({ label: 'Salary Rules', href: '/payroll/rules' });
    if (can(role, 'payslips', 'read'))
      children.push({ label: 'Email Outbox', href: '/payroll/outbox' });

    items.push({ label: 'Payroll', href: '/payroll', children });
  }
  if (can(role, 'workingSchedules', 'create')) {
    items.push({
      label: 'Configuration',
      href: '/config',
      children: [
        { label: 'Working Schedules', href: '/config/schedules' },
        { label: 'Departments', href: '/config/departments' },
        { label: 'Job Positions', href: '/config/positions' },
        ...(can(role, 'users', 'read') ? [{ label: 'Users & Roles', href: '/config/users' }] : []),
      ],
    });
  }
  if (can(role, 'dashboard', 'read')) {
    items.push({ label: 'Reports', href: '/reports' });
  }

  // An Employee account with no linked employee record can reach every page but
  // sees nothing, because all its data is scoped to a record that is not there.
  // Say so, rather than leaving the app looking broken.
  const unlinked = role === 'EMPLOYEE' && !session.employeeId;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav
        items={items}
        user={{ name: session.name, email: session.email, role: session.role }}
      />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {unlinked && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              This account is not linked to an employee record
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Your pages will stay empty until an administrator links it. In Configuration →
              Users &amp; Roles, edit this user and set <strong>Linked Employee</strong>.
            </p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
