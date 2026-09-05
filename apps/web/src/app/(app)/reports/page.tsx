import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  round2,
  type DashboardDto,
  type DepartmentDto,
  type PayslipDto,
  type LeaveRequestDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGetOrRedirect } from '@/lib/api-client';
import { formatMoney, formatHours } from '@/lib/utils';
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

  const params = await searchParams;

  const [data, departments, payslips, leaveRequests] = await Promise.all([
    apiGetOrRedirect<DashboardDto>('/dashboard', '/my-space', {
      month: params.month,
      departmentId: params.department,
      employeeType: params.type,
    }),
    apiGetOrRedirect<DepartmentDto[]>('/departments', '/my-space'),
    apiGetOrRedirect<PayslipDto[]>('/payslips', '/my-space', { limit: 1000 }),
    apiGetOrRedirect<LeaveRequestDto[]>('/time-off/requests', '/my-space', {
      status: 'APPROVED',
      limit: 1000,
    }),
  ]);

  const { kpis, attendance, monthlyTrend } = data;
  const periodLabel = monthlyTrend[monthlyTrend.length - 1]?.month ?? '';

  // Cost by structure, derived from the payslips in view.
  const byStructure = new Map<string, { name: string; count: number; gross: number; net: number }>();
  for (const p of payslips) {
    const existing = byStructure.get(p.structureId) ?? {
      name: p.structure.name,
      count: 0,
      gross: 0,
      net: 0,
    };
    existing.count += 1;
    existing.gross = round2(existing.gross + p.grossPay);
    existing.net = round2(existing.net + p.netPay);
    byStructure.set(p.structureId, existing);
  }

  const topEarners = [...payslips].sort((a, b) => b.netPay - a.netPay).slice(0, 10);

  // Aggregate approved leave per employee.
  const leaveByEmployee = new Map<string, { name: string; department: string; days: number }>();
  for (const r of leaveRequests) {
    const existing = leaveByEmployee.get(r.employeeId) ?? {
      name: r.employee?.fullName ?? '—',
      department: r.employee?.department ?? '—',
      days: 0,
    };
    existing.days = round2(existing.days + r.duration);
    leaveByEmployee.set(r.employeeId, existing);
  }
  const topLeave = [...leaveByEmployee.entries()]
    .sort((a, b) => b[1].days - a[1].days)
    .slice(0, 10);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Aggregated HR and payroll analysis for ${periodLabel}`}
      />

      <DashboardFilters
        departments={departments}
        month={params.month ?? ''}
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
          <MonthlyTrendChart data={monthlyTrend} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
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
                {[...byStructure.values()].map((s) => (
                  <tr key={s.name}>
                    <td className="font-medium text-slate-900">{s.name}</td>
                    <td className="text-right">{s.count}</td>
                    <td className="text-right">{formatMoney(s.gross)}</td>
                    <td className="text-right font-semibold">{formatMoney(s.net)}</td>
                  </tr>
                ))}
                {byStructure.size === 0 && (
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
                      {p.employee?.fullName}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {p.employee?.department ?? '—'}
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

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Most Leave Taken</h2>
          <div className="space-y-2.5">
            {topLeave.map(([employeeId, info], i) => (
              <Link
                key={employeeId}
                href={`/time-off/requests?employee=${employeeId}`}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 text-slate-400">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{info.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {info.department}
                    </span>
                  </span>
                </span>
                <Badge tone="blue">{info.days}d</Badge>
              </Link>
            ))}
            {topLeave.length === 0 && (
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
          tone === 'danger'
            ? 'text-red-600'
            : tone === 'warning'
              ? 'text-amber-600'
              : 'text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
