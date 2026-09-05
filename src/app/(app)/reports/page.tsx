import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { getDashboardData } from '@/lib/dashboard';
import {
  startOfMonth,
  endOfMonth,
  formatMoney,
  formatDate,
  formatHours,
  round2,
} from '@/lib/utils';
import { PageHeader, KpiCard, Badge, ProgressBar } from '@/components/ui';
import { DashboardFilters } from '../dashboard/filters';
import { SalaryByDepartmentChart, MonthlyTrendChart } from '@/components/charts';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ month?: string; department?: string; type?: string }>;
}

export default async function ReportsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'dashboard', 'read')) redirect('/my-space');

  const params = await searchParams;

  const latestPayslip = await prisma.payslip.findFirst({
    orderBy: { periodStart: 'desc' },
    select: { periodStart: true },
  });

  const baseDate = params.month
    ? new Date(`${params.month}-01T00:00:00`)
    : latestPayslip?.periodStart ?? new Date();

  const periodStart = startOfMonth(baseDate);
  const periodEnd = endOfMonth(baseDate);

  const [departments, data, payslipsByStructure, topEarners, leaveByEmployee] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    getDashboardData({
      periodStart,
      periodEnd,
      departmentId: params.department || null,
      employeeType: params.type || null,
    }),
    prisma.payslip.groupBy({
      by: ['structureId'],
      where: { periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } },
      _sum: { netPay: true, grossPay: true, totalDeductions: true },
      _count: true,
    }),
    prisma.payslip.findMany({
      where: {
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        ...(params.department ? { employee: { departmentId: params.department } } : {}),
      },
      include: { employee: { include: { department: true } } },
      orderBy: { netPay: 'desc' },
      take: 10,
    }),
    prisma.leaveRequest.groupBy({
      by: ['employeeId'],
      where: {
        status: 'APPROVED',
        dateFrom: { lte: periodEnd },
        dateTo: { gte: periodStart },
      },
      _sum: { duration: true },
      orderBy: { _sum: { duration: 'desc' } },
      take: 10,
    }),
  ]);

  const structures = await prisma.salaryStructure.findMany({
    where: { id: { in: payslipsByStructure.map((p) => p.structureId) } },
  });

  const leaveEmployees = await prisma.employee.findMany({
    where: { id: { in: leaveByEmployee.map((l) => l.employeeId) } },
    include: { department: true },
  });

  const { kpis, attendance } = data;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Aggregated HR and payroll analysis for ${formatDate(periodStart)} — ${formatDate(periodEnd)}`}
      />

      <DashboardFilters
        departments={departments}
        month={`${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`}
        department={params.department ?? ''}
        type={params.type ?? ''}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Headcount" value={kpis.headcount} />
        <KpiCard label="Total Gross" value={formatMoney(kpis.totalGross)} />
        <KpiCard label="Total Deductions" value={formatMoney(kpis.totalDeductions)} tone="danger" />
        <KpiCard label="Total Net Paid" value={formatMoney(kpis.totalNetPaid)} tone="positive" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Salary Cost by Department</h2>
          <SalaryByDepartmentChart data={data.salaryByDepartment} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Monthly Net Salary Trend</h2>
          <MonthlyTrendChart data={data.monthlyTrend} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Department cost table */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Department Headcount &amp; Cost
          </h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="text-right">Headcount</th>
                  <th className="text-right">Total Net</th>
                  <th className="text-right">Avg / Head</th>
                </tr>
              </thead>
              <tbody>
                {data.salaryByDepartment.map((d) => (
                  <tr key={d.department}>
                    <td className="font-medium text-slate-900">{d.department}</td>
                    <td className="text-right">{d.headcount}</td>
                    <td className="text-right font-semibold">{formatMoney(d.totalNet)}</td>
                    <td className="text-right text-slate-500">
                      {formatMoney(d.headcount > 0 ? round2(d.totalNet / d.headcount) : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Structure breakdown */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Cost by Salary Structure</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Structure</th>
                  <th className="text-right">Payslips</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {payslipsByStructure.map((p) => {
                  const structure = structures.find((s) => s.id === p.structureId);
                  return (
                    <tr key={p.structureId}>
                      <td className="font-medium text-slate-900">{structure?.name ?? '—'}</td>
                      <td className="text-right">{p._count}</td>
                      <td className="text-right">{formatMoney(p._sum.grossPay ?? 0)}</td>
                      <td className="text-right font-semibold">
                        {formatMoney(p._sum.netPay ?? 0)}
                      </td>
                    </tr>
                  );
                })}
                {payslipsByStructure.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-slate-400">
                      No payroll in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {/* Attendance quality */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Attendance Quality</h2>
          <dl className="space-y-3">
            <StatRow label="Records" value={String(attendance.totalRecords)} />
            <StatRow label="Present" value={String(attendance.present)} />
            <StatRow label="Late" value={String(attendance.late)} tone="warning" />
            <StatRow label="Half day" value={String(attendance.halfDay)} />
            <StatRow
              label="Missing check-out"
              value={String(attendance.missingCheckout)}
              tone="danger"
            />
            <StatRow label="Manual edits" value={String(attendance.manualEdits)} />
            <StatRow label="Worked hours" value={formatHours(attendance.totalWorkedHours)} />
            <StatRow label="Overtime" value={formatHours(attendance.totalOvertimeHours)} />
          </dl>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-600">Attendance health</span>
              <span className="font-semibold text-slate-900">{attendance.healthPercent}%</span>
            </div>
            <ProgressBar
              value={attendance.healthPercent}
              max={100}
              colorHex={attendance.healthPercent >= 80 ? '#059669' : '#d97706'}
            />
          </div>
        </div>

        {/* Top earners */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Highest Net Pay</h2>
          <div className="space-y-2.5">
            {topEarners.map((p, i) => (
              <Link
                key={p.id}
                href={`/payroll/payslips/${p.id}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 text-slate-400">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">
                      {p.employee.firstName} {p.employee.lastName}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {p.employee.department?.name ?? '—'}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-slate-900">
                  {formatMoney(p.netPay)}
                </span>
              </Link>
            ))}
            {topEarners.length === 0 && (
              <p className="text-sm text-slate-400">No payslips in this period.</p>
            )}
          </div>
        </div>

        {/* Leave usage */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Most Leave Taken</h2>
          <div className="space-y-2.5">
            {leaveByEmployee.map((l, i) => {
              const emp = leaveEmployees.find((e) => e.id === l.employeeId);
              if (!emp) return null;
              return (
                <Link
                  key={l.employeeId}
                  href={`/time-off/requests?employee=${l.employeeId}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 text-slate-400">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {emp.firstName} {emp.lastName}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {emp.department?.name ?? '—'}
                      </span>
                    </span>
                  </span>
                  <Badge tone="blue">{l._sum.duration ?? 0}d</Badge>
                </Link>
              );
            })}
            {leaveByEmployee.length === 0 && (
              <p className="text-sm text-slate-400">No approved leave in this period.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warning' | 'danger';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd
        className={`font-semibold ${
          tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
