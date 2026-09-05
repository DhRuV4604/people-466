import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import {
  formatDate,
  formatTime,
  formatHours,
  toDateInput,
  startOfDay,
  endOfDay,
  startOfMonth,
} from '@/lib/utils';
import { getAttendanceSummary } from '@/lib/attendance';
import { PageHeader, StatusBadge, Avatar, EmptyState, KpiCard, Badge } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    employee?: string;
    status?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}

export default async function AttendancePage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'attendance', 'read')) redirect('/my-space');

  const params = await searchParams;

  const now = new Date();
  const from = params.from ? new Date(params.from) : startOfMonth(now);
  const to = params.to ? new Date(params.to) : now;

  const ownScope =
    session.role === 'EMPLOYEE' ? { employeeId: session.employeeId ?? '__none__' } : {};

  const where = {
    ...ownScope,
    checkIn: { gte: startOfDay(from), lte: endOfDay(to) },
    ...(params.employee ? { employeeId: params.employee } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { employee: { firstName: { contains: params.q } } },
            { employee: { lastName: { contains: params.q } } },
          ],
        }
      : {}),
  };

  const [records, employee, summary] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: { employee: { include: { department: true } } },
      orderBy: { checkIn: 'desc' },
      take: 300,
    }),
    params.employee
      ? prisma.employee.findUnique({ where: { id: params.employee } })
      : Promise.resolve(null),
    getAttendanceSummary({
      from,
      to,
      employeeId: params.employee ?? (session.role === 'EMPLOYEE' ? session.employeeId : null),
    }),
  ]);

  const canCreate = can(session.role, 'attendance', 'create');

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={
          employee
            ? `Attendance for ${employee.firstName} ${employee.lastName}`
            : `${records.length} record${records.length === 1 ? '' : 's'} between ${formatDate(from)} and ${formatDate(to)}`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: `${employee.firstName} ${employee.lastName}`, href: `/employees/${employee.id}` },
                { label: 'Attendance', href: `/attendance?employee=${employee.id}` },
              ]
            : undefined
        }
        actions={
          canCreate ? (
            <Link
              href={`/attendance/new${params.employee ? `?employee=${params.employee}` : ''}`}
              className="btn-primary"
            >
              New Entry
            </Link>
          ) : null
        }
      />

      {/* Summary strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Records" value={summary.totalRecords} />
        <KpiCard label="Present" value={summary.present} tone="positive" />
        <KpiCard label="Late" value={summary.late} tone={summary.late > 0 ? 'warning' : 'default'} />
        <KpiCard
          label="Missing Checkout"
          value={summary.missingCheckout}
          tone={summary.missingCheckout > 0 ? 'danger' : 'default'}
        />
        <KpiCard label="Worked" value={formatHours(summary.totalWorkedHours)} />
        <KpiCard label="Overtime" value={formatHours(summary.totalOvertimeHours)} />
      </div>

      <ListFilters
        search={{ value: params.q ?? '', placeholder: 'Search employee…' }}
        dateRange={{ from: toDateInput(from), to: toDateInput(to) }}
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: params.status ?? '',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'PRESENT', label: 'Present' },
              { value: 'LATE', label: 'Late' },
              { value: 'HALF_DAY', label: 'Half day' },
              { value: 'MISSING_CHECKOUT', label: 'Missing checkout' },
              { value: 'ABSENT', label: 'Absent' },
            ],
          },
        ]}
      />

      {records.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No attendance records"
            description="Adjust the date range or filters to see entries."
          />
        </div>
      ) : (
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Worked Hours</th>
                <th>Overtime</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/employees/${r.employeeId}`}
                      className="flex items-center gap-2.5 hover:text-brand-700"
                    >
                      <Avatar
                        firstName={r.employee.firstName}
                        lastName={r.employee.lastName}
                        size="sm"
                        seed={r.employeeId}
                      />
                      <span>
                        <span className="block font-medium text-slate-900">
                          {r.employee.firstName} {r.employee.lastName}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {r.employee.department?.name ?? '—'}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td>{formatDate(r.checkIn)}</td>
                  <td className="font-mono text-xs">{formatTime(r.checkIn)}</td>
                  <td className="font-mono text-xs">
                    {r.checkOut ? (
                      formatTime(r.checkOut)
                    ) : (
                      <span className="text-orange-600">—</span>
                    )}
                  </td>
                  <td className="font-medium">{formatHours(r.workedHours)}</td>
                  <td>
                    {r.overtimeHours > 0 ? (
                      <span className="font-medium text-emerald-600">
                        {formatHours(r.overtimeHours)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={r.status} />
                      {r.manuallyEdited && <Badge tone="violet">Edited</Badge>}
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/attendance/${r.id}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
