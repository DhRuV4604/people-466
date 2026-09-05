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

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav
        items={items}
        user={{ name: session.name, email: session.email, role: session.role }}
      />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
