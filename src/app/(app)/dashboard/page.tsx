import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { getDashboardData } from '@/lib/dashboard';
import { startOfMonth, endOfMonth, formatMoney, formatMoneyShort, formatDate, formatHours } from '@/lib/utils';
import { PageHeader, KpiCard, ProgressBar, Badge } from '@/components/ui';
import {
  SalaryByDepartmentChart,
  MonthlyTrendChart,
  TimeOffByTypeChart,
  AttendanceBreakdownChart,
} from '@/components/charts';
import { DashboardFilters } from './filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ month?: string; department?: string; type?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'dashboard', 'read')) redirect('/my-space');

  const params = await searchParams;

  // Default to the most recent month that actually has payroll data, so the
  // dashboard opens on something meaningful rather than an empty current month.
  const latestPayslip = await prisma.payslip.findFirst({
    orderBy: { periodStart: 'desc' },
    select: { periodStart: true },
  });

  const baseDate = params.month
    ? new Date(`${params.month}-01T00:00:00`)
    : latestPayslip?.periodStart ?? new Date();

  const periodStart = startOfMonth(baseDate);
  const periodEnd = endOfMonth(baseDate);

  const [departments, data] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    getDashboardData({
      periodStart,
      periodEnd,
      departmentId: params.department || null,
      employeeType: params.type || null,
    }),
  ]);

  const { kpis, alerts, attendance, timeOff } = data;

  const attendanceChartData = [
    { label: 'Present', value: attendance.present, color: '#059669' },
    { label: 'Late', value: attendance.late, color: '#d97706' },
    { label: 'Half day', value: attendance.halfDay, color: '#2563eb' },
    { label: 'Missing checkout', value: attendance.missingCheckout, color: '#ea580c' },
    { label: 'Manual edits', value: attendance.manualEdits, color: '#7c3aed' },
  ];

  const totalAlerts =
    alerts.missingBankDetails.length +
    alerts.noContract.length +
    alerts.expiringContracts.length +
    alerts.duplicatePayslips.length +
    alerts.draftPayruns.length;

  return (
    <>
      <PageHeader
        title="Payroll Dashboard"
        subtitle={`Live HR and payroll metrics for ${formatDate(periodStart)} — ${formatDate(periodEnd)}`}
      />

      <DashboardFilters
        departments={departments}
        month={params.month ?? `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`}
        department={params.department ?? ''}
        type={params.type ?? ''}
      />

      {/* KPI cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Total Net Salary"
          value={formatMoneyShort(kpis.totalNetPaid)}
          sublabel={`${formatMoney(kpis.totalGross)} gross`}
          tone="positive"
        />
        <KpiCard
          label="Payslips Generated"
          value={kpis.payslipsGenerated}
          sublabel={`${kpis.headcount} active employees`}
        />
        <KpiCard
          label="Average Salary"
          value={formatMoneyShort(kpis.averageSalary)}
          sublabel="Net per payslip"
        />
        <KpiCard
          label="Approved Time Off"
          value={`${kpis.approvedTimeOffDays}d`}
          sublabel={`${timeOff.pendingRequests} pending`}
          tone={timeOff.pendingRequests > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Attendance Health"
          value={`${kpis.attendanceHealth}%`}
          sublabel={`${attendance.totalRecords} records`}
          tone={kpis.attendanceHealth >= 80 ? 'positive' : kpis.attendanceHealth >= 60 ? 'warning' : 'danger'}
        />
      </div>

      {/* Charts */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Salary Cost by Department</h2>
              <p className="text-xs text-slate-500">Net salary paid in the selected period</p>
            </div>
          </div>
          <SalaryByDepartmentChart data={data.salaryByDepartment} />
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Monthly Net Salary Trend</h2>
            <p className="text-xs text-slate-500">Rolling twelve months of payroll history</p>
          </div>
          <MonthlyTrendChart data={data.monthlyTrend} />
        </div>
      </div>

      {/* Operational alerts */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Operational Alerts</h2>
              <p className="text-xs text-slate-500">Items needing attention before payroll finalisation</p>
            </div>
            <Badge tone={totalAlerts > 0 ? 'amber' : 'emerald'}>
              {totalAlerts > 0 ? `${totalAlerts} open` : 'All clear'}
            </Badge>
          </div>

          {totalAlerts === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
              No outstanding payroll or HR issues for these filters.
            </div>
          ) : (
            <div className="space-y-2.5">
              <AlertRow
                tone="red"
                label="Missing bank details"
                count={alerts.missingBankDetails.length}
                detail={alerts.missingBankDetails.slice(0, 3).map((e) => e.name).join(', ')}
                href="/employees?missingBank=1"
              />
              <AlertRow
                tone="red"
                label="No applicable contract for period"
                count={alerts.noContract.length}
                detail={alerts.noContract.slice(0, 3).map((e) => e.name).join(', ')}
                href="/contracts"
              />
              <AlertRow
                tone="amber"
                label="Contracts expiring within 30 days"
                count={alerts.expiringContracts.length}
                detail={alerts.expiringContracts
                  .slice(0, 3)
                  .map((c) => `${c.name} (${formatDate(c.dateEnd)})`)
                  .join(', ')}
                href="/contracts?expiring=1"
              />
              <AlertRow
                tone="red"
                label="Duplicate payslips"
                count={alerts.duplicatePayslips.length}
                detail={alerts.duplicatePayslips.slice(0, 2).map((d) => d.employee).join(', ')}
                href="/payroll/payslips"
              />
              <AlertRow
                tone="amber"
                label="Pay runs awaiting validation"
                count={alerts.draftPayruns.length}
                detail={alerts.draftPayruns.slice(0, 3).map((p) => p.name).join(', ')}
                href="/payroll/payruns"
              />
              <AlertRow
                tone="amber"
                label="Leave allocations awaiting approval"
                count={alerts.pendingAllocations}
                detail=""
                href="/time-off/allocations?status=DRAFT"
              />
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Time Off Overview</h2>
          <TimeOffByTypeChart data={timeOff.byType} />
          <div className="mt-3 space-y-2">
            {timeOff.byType.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.colorHex }} />
                  {t.name}
                </span>
                <span className="font-semibold text-slate-900">{t.days}d</span>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <span className="text-slate-600">Pending requests</span>
              <Badge tone={timeOff.pendingRequests > 0 ? 'amber' : 'slate'}>
                {timeOff.pendingRequests}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance + department breakdown */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Attendance Overview</h2>
              <p className="text-xs text-slate-500">
                {attendance.coveragePercent}% coverage · {formatHours(attendance.totalWorkedHours)} worked
              </p>
            </div>
          </div>
          <AttendanceBreakdownChart data={attendanceChartData} />
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <MiniStat label="Overtime" value={formatHours(attendance.totalOvertimeHours)} />
            <MiniStat label="Missing checkout" value={String(attendance.missingCheckout)} />
            <MiniStat label="Manual edits" value={String(attendance.manualEdits)} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Department Breakdown
          </h2>
          <div className="space-y-3.5">
            {data.salaryByDepartment.map((dept, i) => {
              const max = Math.max(...data.salaryByDepartment.map((d) => d.totalNet), 1);
              return (
                <div key={dept.department}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{dept.department}</span>
                    <span className="text-slate-500">
                      {dept.headcount} staff ·{' '}
                      <span className="font-semibold text-slate-900">
                        {formatMoneyShort(dept.totalNet)}
                      </span>
                    </span>
                  </div>
                  <ProgressBar
                    value={dept.totalNet}
                    max={max}
                    colorHex={['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626'][i % 5]}
                  />
                </div>
              );
            })}
            {data.salaryByDepartment.length === 0 && (
              <p className="text-sm text-slate-400">No department data for these filters.</p>
            )}
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="section-title mb-2.5">Employee Types</p>
            <div className="flex flex-wrap gap-2">
              {data.employeeTypeBreakdown.map((t) => (
                <Badge key={t.type} tone="violet">
                  {t.type.replace('_', ' ')}: {t.count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function AlertRow({
  tone,
  label,
  count,
  detail,
  href,
}: {
  tone: 'red' | 'amber';
  label: string;
  count: number;
  detail: string;
  href: string;
}) {
  if (count === 0) return null;

  const tones = {
    red: 'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
  };

  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition hover:brightness-[0.98] ${tones[tone]}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {detail && <p className="truncate text-xs text-slate-600">{detail}</p>}
      </div>
      <Badge tone={tone}>{count}</Badge>
    </Link>
  );
}
