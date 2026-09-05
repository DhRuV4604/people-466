import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  can,
  type EmployeeDetailDto,
  type ContractDto,
  type LeaveBalanceDto,
  type AttendanceDto,
  type PayslipDto,
  type DepartmentDto,
  type JobPositionDto,
  type WorkingScheduleDto,
  type EmployeeSummaryDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiFetch, apiGet, ApiError } from '@/lib/api-client';
import { formatDate, formatMoney, formatHours, splitName } from '@/lib/utils';
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

  const employee = await apiFetch<EmployeeDetailDto | null>(`/employees/${id}`, {
    nullOn404: true,
  }).catch((err) => {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/my-space');
    throw err;
  });

  if (!employee) notFound();

  const canReadPayslips = can(session.role, 'payslips', 'read');
  const canUpdate = can(session.role, 'employees', 'update');
  const canDelete = can(session.role, 'employees', 'delete');

  const [contracts, balances, recentAttendance, recentPayslips, departments, positions, managers, schedules] =
    await Promise.all([
      apiGet<ContractDto[]>('/contracts', { employeeId: id }),
      apiGet<LeaveBalanceDto[]>(`/time-off/balances/${id}`),
      apiGet<AttendanceDto[]>('/attendance', { employeeId: id, limit: 5, from: '2000-01-01' }),
      canReadPayslips
        ? apiGet<PayslipDto[]>('/payslips', { employeeId: id, limit: 5 })
        : Promise.resolve([] as PayslipDto[]),
      apiGet<DepartmentDto[]>('/departments'),
      apiGet<JobPositionDto[]>('/job-positions'),
      apiGet<EmployeeSummaryDto[]>('/employees', { status: 'ACTIVE' }),
      apiGet<WorkingScheduleDto[]>('/working-schedules'),
    ]);

  // The API flags which contract governs the current period.
  const activeContract = contracts.find((c) => c.isApplicableForPeriod) ?? null;
  const { first, last } = splitName(employee.fullName);

  const warnings: string[] = [];
  if (!employee.bankName || !employee.bankAccountNumber)
    warnings.push('Bank details are missing — payroll cannot release payment.');
  if (!activeContract)
    warnings.push(
      'No running contract covers the current period — this employee is not payroll-eligible.'
    );
  if (!employee.workingScheduleId)
    warnings.push(
      'No working schedule assigned — attendance and leave calculations will use defaults.'
    );

  return (
    <>
      <PageHeader
        title={employee.fullName}
        subtitle={`${employee.employeeCode} · ${employee.jobPosition?.name ?? 'No position'}`}
        breadcrumb={[
          { label: 'Employees', href: '/employees' },
          { label: employee.fullName, href: `/employees/${id}` },
        ]}
        actions={canDelete ? <DeleteEmployeeButton id={id} name={employee.fullName} /> : null}
      />

      {warnings.length > 0 && (
        <div className="mb-5">
          <AlertBanner tone="warning" title="Attention required" items={warnings} />
        </div>
      )}

      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar firstName={first} lastName={last} size="xl" seed={employee.id} />
            <div>
              <h2 className="text-xl font-bold text-slate-900">{employee.fullName}</h2>
              <p className="text-sm text-slate-500">{employee.workEmail}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={employee.status} />
                <Badge tone="slate">{employee.employeeType.replace('_', ' ')}</Badge>
                {employee.department && <Badge tone="violet">{employee.department.name}</Badge>}
              </div>
            </div>
          </div>

          {/* Smart buttons open filtered related views */}
          <div className="flex flex-wrap gap-2">
            <SmartButton
              href={`/contracts?employee=${id}`}
              label="Contracts"
              count={employee.counts.contracts}
            />
            <SmartButton
              href={`/attendance?employee=${id}`}
              label="Attendance"
              count={employee.counts.attendances}
            />
            <SmartButton
              href={`/time-off/requests?employee=${id}`}
              label="Time Off"
              count={employee.counts.leaveRequests}
            />
            <SmartButton
              href={`/time-off/allocations?employee=${id}`}
              label="Allocations"
              count={employee.counts.leaveAllocations}
            />
            {canReadPayslips && (
              <SmartButton
                href={`/payroll/payslips?employee=${id}`}
                label="Payslips"
                count={employee.counts.payslips}
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
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Active Contract</h3>
              <Link
                href={`/contracts?employee=${id}`}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
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
                        <span className="font-semibold text-slate-900">{b.remaining}</span> /{' '}
                        {b.allocated} {b.unit === 'DAY' ? 'days' : 'hrs'}
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

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Attendance</h3>
              <Link
                href={`/attendance?employee=${id}`}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
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
