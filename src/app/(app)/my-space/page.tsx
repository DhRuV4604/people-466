import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getLeaveBalances } from '@/lib/timeoff';
import { getAttendanceSummary } from '@/lib/attendance';
import { resolveContractForPeriod } from '@/lib/contracts';
import {
  formatDate,
  formatTime,
  formatHours,
  formatMoney,
  startOfMonth,
  endOfMonth,
} from '@/lib/utils';
import {
  PageHeader,
  StatusBadge,
  Avatar,
  Field,
  ProgressBar,
  KpiCard,
  EmptyState,
} from '@/components/ui';
import { CheckInOut } from './check-in-out';

export const dynamic = 'force-dynamic';

export default async function MySpacePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (!session.employeeId) {
    return (
      <>
        <PageHeader title="My Space" />
        <EmptyState
          title="No employee record linked"
          description="This account is not linked to an employee record. Ask an administrator to link it from Configuration → Users & Roles."
        />
      </>
    );
  }

  const employeeId = session.employeeId;
  const now = new Date();
  const periodStart = startOfMonth(now);
  const periodEnd = endOfMonth(now);

  const [employee, balances, attendanceSummary, recentAttendance, openEntry, requests, payslips] =
    await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          department: true,
          jobPosition: true,
          manager: true,
          workingSchedule: true,
          contracts: { include: { salaryStructure: true } },
        },
      }),
      getLeaveBalances(employeeId),
      getAttendanceSummary({ from: periodStart, to: periodEnd, employeeId }),
      prisma.attendance.findMany({
        where: { employeeId },
        orderBy: { checkIn: 'desc' },
        take: 8,
      }),
      prisma.attendance.findFirst({
        where: { employeeId, checkOut: null },
        orderBy: { checkIn: 'desc' },
      }),
      prisma.leaveRequest.findMany({
        where: { employeeId },
        include: { type: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.payslip.findMany({
        where: { employeeId, status: { in: ['VALIDATED', 'PAID'] } },
        orderBy: { periodStart: 'desc' },
        take: 6,
      }),
    ]);

  if (!employee) redirect('/login');

  const contract = resolveContractForPeriod(employee.contracts, periodStart, periodEnd);

  return (
    <>
      <PageHeader
        title="My Space"
        subtitle="Your profile, attendance, leave balances and payslips."
        actions={
          <Link href="/time-off/requests/new" className="btn-primary">
            Request Time Off
          </Link>
        }
      />

      {/* Identity + check in/out */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <Avatar
              firstName={employee.firstName}
              lastName={employee.lastName}
              size="xl"
              seed={employee.id}
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-sm text-slate-500">
                {employee.jobPosition?.name ?? '—'} · {employee.department?.name ?? '—'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={employee.status} />
                <span className="text-xs text-slate-500">{employee.employeeCode}</span>
              </div>
            </div>
          </div>

          <CheckInOut
            openEntry={
              openEntry
                ? { id: openEntry.id, checkIn: openEntry.checkIn.toISOString() }
                : null
            }
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Days Present" value={attendanceSummary.present} tone="positive" />
        <KpiCard
          label="Hours Worked"
          value={formatHours(attendanceSummary.totalWorkedHours)}
          sublabel="This month"
        />
        <KpiCard
          label="Overtime"
          value={formatHours(attendanceSummary.totalOvertimeHours)}
          sublabel="This month"
        />
        <KpiCard
          label="Late Arrivals"
          value={attendanceSummary.late}
          tone={attendanceSummary.late > 0 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Attendance */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Recent Attendance</h3>
              <Link href="/attendance" className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            </div>

            {recentAttendance.length === 0 ? (
              <p className="text-sm text-slate-400">No attendance recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Worked</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDate(a.checkIn)}</td>
                        <td className="font-mono text-xs">{formatTime(a.checkIn)}</td>
                        <td className="font-mono text-xs">
                          {a.checkOut ? formatTime(a.checkOut) : <span className="text-orange-600">—</span>}
                        </td>
                        <td>{formatHours(a.workedHours)}</td>
                        <td>
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Time off requests */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">My Time Off Requests</h3>
              <Link
                href="/time-off/requests"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                View all
              </Link>
            </div>

            {requests.length === 0 ? (
              <p className="text-sm text-slate-400">No requests submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <Link
                    key={r.id}
                    href={`/time-off/requests/${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ background: r.type.colorHex }}
                        />
                        {r.type.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(r.dateFrom)} — {formatDate(r.dateTo)} · {r.duration}{' '}
                        {r.type.unit === 'DAY' ? 'day(s)' : 'hour(s)'}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Payslips */}
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">My Payslips</h3>
            {payslips.length === 0 ? (
              <p className="text-sm text-slate-400">No payslips issued yet.</p>
            ) : (
              <div className="space-y-2">
                {payslips.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                      </p>
                      <p className="font-mono text-xs text-slate-500">{p.number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">
                        {formatMoney(p.netPay)}
                      </span>
                      <StatusBadge status={p.status} />
                      <a
                        href={`/api/payslips/${p.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary btn-sm"
                      >
                        PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Leave balances */}
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Leave Balances</h3>
            <div className="space-y-4">
              {balances
                .filter((b) => b.requiresAllocation)
                .map((b) => (
                  <div key={b.typeId}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{b.typeName}</span>
                      <span className="text-slate-500">
                        <span className="font-semibold text-slate-900">{b.remaining}</span> /{' '}
                        {b.allocated}
                      </span>
                    </div>
                    <ProgressBar value={b.taken} max={b.allocated || 1} colorHex={b.colorHex} />
                    <p className="mt-1 text-[11px] text-slate-400">
                      {b.taken} taken
                      {b.pending > 0 && ` · ${b.pending} pending`}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          {/* Employment details */}
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">My Details</h3>
            <dl className="space-y-3.5">
              <Field label="Work Email">{employee.workEmail}</Field>
              <Field label="Department">{employee.department?.name ?? '—'}</Field>
              <Field label="Manager">
                {employee.manager
                  ? `${employee.manager.firstName} ${employee.manager.lastName}`
                  : '—'}
              </Field>
              <Field label="Working Schedule">
                {employee.workingSchedule
                  ? `${employee.workingSchedule.name} (${employee.workingSchedule.hoursPerWeek}h/week)`
                  : '—'}
              </Field>
              <Field label="Employee Type">{employee.employeeType.replace('_', ' ')}</Field>
              <Field label="Hire Date">{formatDate(employee.hireDate)}</Field>
              {contract && (
                <Field label="Current Contract">
                  {contract.name}
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Since {formatDate(contract.dateStart)}
                  </span>
                </Field>
              )}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
