import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  can,
  type AttendanceDto,
  type AttendanceSummaryDto,
  type EmployeeDetailDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch } from '@/lib/api-client';
import {
  formatDate,
  formatTime,
  formatHours,
  toDateInput,
  startOfMonth,
} from '@/lib/utils';
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

  const params = await searchParams;

  const now = new Date();
  const from = params.from ?? toDateInput(startOfMonth(now));
  const to = params.to ?? toDateInput(now);

  const [records, summary, employee] = await Promise.all([
    apiGet<AttendanceDto[]>('/attendance', {
      employeeId: params.employee,
      status: params.status,
      from,
      to,
      q: params.q,
    }),
    apiGet<AttendanceSummaryDto>('/attendance/summary', {
      employeeId: params.employee,
      from,
      to,
    }),
    params.employee
      ? apiFetch<EmployeeDetailDto | null>(`/employees/${params.employee}`, { nullOn404: true })
      : Promise.resolve(null),
  ]);

  const canCreate = can(session.role, 'attendance', 'create');

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={
          employee
            ? `Attendance for ${employee.fullName}`
            : `${records.length} record${records.length === 1 ? '' : 's'} between ${formatDate(from)} and ${formatDate(to)}`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: employee.fullName, href: `/employees/${employee.id}` },
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
        dateRange={{ from, to }}
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
              {records.map((r) => {
                const name = r.employee?.fullName ?? '';
                const parts = name.split(' ');
                return (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/employees/${r.employeeId}`}
                        className="flex items-center gap-2.5 hover:text-brand-700"
                      >
                        <Avatar
                          firstName={parts[0] ?? ''}
                          lastName={parts[parts.length - 1] ?? ''}
                          size="sm"
                          seed={r.employeeId}
                        />
                        <span>
                          <span className="block font-medium text-slate-900">{name}</span>
                          <span className="block text-xs text-slate-500">
                            {r.employee?.department ?? '—'}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>{formatDate(r.checkIn)}</td>
                    <td className="font-mono text-xs">{formatTime(r.checkIn)}</td>
                    <td className="font-mono text-xs">
                      {r.checkOut ? formatTime(r.checkOut) : <span className="text-orange-600">—</span>}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
