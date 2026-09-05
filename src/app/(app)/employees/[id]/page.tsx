import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatMoney, formatHours } from '@/lib/utils';
import { getLeaveBalances } from '@/lib/timeoff';
import { resolveContractForPeriod } from '@/lib/contracts';
import { startOfMonth, endOfMonth } from '@/lib/utils';
import {
  PageHeader,
  StatusBadge,
  Avatar,
  Badge,
  SmartButton,
  Field,
  ProgressBar,
  AlertBanner,
} from '@/components/ui';
import { EmployeeForm } from '@/components/employee-form';
import { updateEmployeeAction } from '../actions';
import { DeleteEmployeeButton } from './delete-button';

export const dynamic = 'force-dynamic';

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'employees', 'read')) redirect('/my-space');

  // An employee may only open their own record.
  if (session.role === 'EMPLOYEE' && session.employeeId !== id) redirect('/my-space');

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      department: true,
      jobPosition: true,
      manager: true,
      workingSchedule: { include: { lines: true } },
      user: true,
      _count: {
        select: {
          contracts: true,
          attendances: true,
          leaveRequests: true,
          leaveAllocations: true,
          payslips: true,
        },
      },
    },
  });

  if (!employee) notFound();

  const now = new Date();
  const periodStart = startOfMonth(now);
  const periodEnd = endOfMonth(now);

  const [contracts, balances, recentAttendance, recentPayslips, departments, positions, managers, schedules] =
    await Promise.all([
      prisma.contract.findMany({
        where: { employeeId: id },
        include: { salaryStructure: true, jobPosition: true },
        orderBy: { dateStart: 'desc' },
      }),
      getLeaveBalances(id),
      prisma.attendance.findMany({
        where: { employeeId: id },
        orderBy: { checkIn: 'desc' },
        take: 5,
      }),
      can(session.role, 'payslips', 'read')
        ? prisma.payslip.findMany({
            where: { employeeId: id },
            include: { payrun: true },
            orderBy: { periodStart: 'desc' },
            take: 5,
          })
        : Promise.resolve([]),
      prisma.department.findMany({ orderBy: { name: 'asc' } }),
      prisma.jobPosition.findMany({ orderBy: { name: 'asc' } }),
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: 'asc' },
      }),
      prisma.workingSchedule.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);

  const activeContract = resolveContractForPeriod(contracts, periodStart, periodEnd);
  const canUpdate = can(session.role, 'employees', 'update');
  const canDelete = can(session.role, 'employees', 'delete');

  const warnings: string[] = [];
  if (!employee.bankAccountNumber || !employee.bankName)
    warnings.push('Bank details are missing — payroll cannot release payment.');
  if (!activeContract)
    warnings.push('No running contract covers the current period — this employee is not payroll-eligible.');
  if (!employee.workingScheduleId)
    warnings.push('No working schedule assigned — attendance and leave calculations will use defaults.');

  return (
    <>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        subtitle={`${employee.employeeCode} · ${employee.jobPosition?.name ?? 'No position'}`}
        breadcrumb={[
          { label: 'Employees', href: '/employees' },
          { label: `${employee.firstName} ${employee.lastName}`, href: `/employees/${id}` },
        ]}
        actions={canDelete ? <DeleteEmployeeButton id={id} name={`${employee.firstName} ${employee.lastName}`} /> : null}
      />

      {warnings.length > 0 && (
        <div className="mb-5">
          <AlertBanner tone="warning" title="Attention required" items={warnings} />
        </div>
      )}

      {/* Identity header + smart buttons */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar firstName={employee.firstName} lastName={employee.lastName} size="xl" seed={employee.id} />
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-sm text-slate-500">{employee.workEmail}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={employee.status} />
                <Badge tone="slate">{employee.employeeType.replace('_', ' ')}</Badge>
                {employee.department && <Badge tone="violet">{employee.department.name}</Badge>}
              </div>
            </div>
          </div>

          {/* Smart buttons open filtered related views (spec B2) */}
          <div className="flex flex-wrap gap-2">
            <SmartButton
              href={`/contracts?employee=${id}`}
              label="Contracts"
              count={employee._count.contracts}
            />
            <SmartButton
              href={`/attendance?employee=${id}`}
              label="Attendance"
              count={employee._count.attendances}
            />
            <SmartButton
              href={`/time-off/requests?employee=${id}`}
              label="Time Off"
              count={employee._count.leaveRequests}
            />
            <SmartButton
              href={`/time-off/allocations?employee=${id}`}
              label="Allocations"
              count={employee._count.leaveAllocations}
            />
            {can(session.role, 'payslips', 'read') && (
              <SmartButton
                href={`/payroll/payslips?employee=${id}`}
                label="Payslips"
                count={employee._count.payslips}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EmployeeForm
            action={updateEmployeeAction}
            employee={employee}
            departments={departments}
            positions={positions}
            managers={managers}
            schedules={schedules}
            submitLabel="Save Changes"
            cancelHref="/employees"
            readOnly={!canUpdate}
          />
        </div>

        <div className="space-y-5">
          {/* Active contract */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Active Contract</h3>
              <Link href={`/contracts?employee=${id}`} className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            </div>

            {activeContract ? (
              <dl className="space-y-3">
                <Field label="Contract">{activeContract.name}</Field>
                <Field label="Wage">{formatMoney(activeContract.wage)} / month</Field>
                <Field label="Period">
                  {formatDate(activeContract.dateStart)} —{' '}
                  {activeContract.dateEnd ? formatDate(activeContract.dateEnd) : 'Open ended'}
                </Field>
                <Field label="Salary Structure">
                  {activeContract.salaryStructure?.name ?? '—'}
                </Field>
                <Field label="Status">
                  <StatusBadge status={activeContract.status} />
                </Field>
              </dl>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                No running contract for the current period.
              </p>
            )}
          </div>

          {/* Leave balances */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Leave Balances</h3>
              <Link
                href={`/time-off/allocations?employee=${id}`}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Allocations
              </Link>
            </div>

            <div className="space-y-3.5">
              {balances
                .filter((b) => b.requiresAllocation)
                .map((b) => (
                  <div key={b.typeId}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{b.typeName}</span>
                      <span className="text-slate-500">
                        <span className="font-semibold text-slate-900">{b.remaining}</span> / {b.allocated}{' '}
                        {b.unit === 'DAY' ? 'days' : 'hrs'}
                      </span>
                    </div>
                    <ProgressBar value={b.taken} max={b.allocated || 1} colorHex={b.colorHex} />
                    {b.pending > 0 && (
                      <p className="mt-1 text-[11px] text-amber-600">{b.pending} pending approval</p>
                    )}
                  </div>
                ))}
              {balances.filter((b) => b.requiresAllocation).length === 0 && (
                <p className="text-sm text-slate-400">No allocation-based leave types.</p>
              )}
            </div>
          </div>

          {/* Recent attendance */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Attendance</h3>
              <Link href={`/attendance?employee=${id}`} className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            </div>

            <div className="space-y-2">
              {recentAttendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{formatDate(a.checkIn)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-slate-500">{formatHours(a.workedHours)}</span>
                    <StatusBadge status={a.status} />
                  </span>
                </div>
              ))}
              {recentAttendance.length === 0 && (
                <p className="text-sm text-slate-400">No attendance recorded.</p>
              )}
            </div>
          </div>

          {/* Recent payslips */}
          {recentPayslips.length > 0 && (
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Recent Payslips</h3>
                <Link
                  href={`/payroll/payslips?employee=${id}`}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {recentPayslips.map((p) => (
                  <Link
                    key={p.id}
                    href={`/payroll/payslips/${p.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
                  >
                    <span className="text-slate-600">{formatDate(p.periodStart)}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{formatMoney(p.netPay)}</span>
                      <StatusBadge status={p.status} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
