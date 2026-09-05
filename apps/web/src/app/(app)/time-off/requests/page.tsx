import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  can,
  type LeaveRequestDto,
  type TimeOffTypeDto,
  type EmployeeDetailDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch } from '@/lib/api-client';
import { formatDate, splitName } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, EmptyState, Badge, Tabs, KpiCard } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ employee?: string; status?: string; type?: string; q?: string }>;
}

export default async function LeaveRequestsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;

  const [requests, allRequests, types, employee] = await Promise.all([
    apiGet<LeaveRequestDto[]>('/time-off/requests', {
      employeeId: params.employee,
      status: params.status,
      typeId: params.type,
      q: params.q,
    }),
    // Unfiltered set drives the status counters above the table.
    apiGet<LeaveRequestDto[]>('/time-off/requests', { limit: 1000 }),
    apiGet<TimeOffTypeDto[]>('/time-off/types'),
    params.employee
      ? apiFetch<EmployeeDetailDto | null>(`/employees/${params.employee}`, { nullOn404: true })
      : Promise.resolve(null),
  ]);

  const countFor = (status: string) => allRequests.filter((r) => r.status === status).length;

  const canCreate = can(session.role, 'timeOffRequests', 'create');
  const canApprove = can(session.role, 'timeOffRequests', 'approve');

  return (
    <>
      <PageHeader
        title="Time Off Requests"
        subtitle={
          employee
            ? `Requests for ${employee.fullName}`
            : `${requests.length} request${requests.length === 1 ? '' : 's'}`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: employee.fullName, href: `/employees/${employee.id}` },
                { label: 'Time Off', href: `/time-off/requests?employee=${employee.id}` },
              ]
            : undefined
        }
        actions={
          canCreate ? (
            <Link
              href={`/time-off/requests/new${params.employee ? `?employee=${params.employee}` : ''}`}
              className="btn-primary"
            >
              New Request
            </Link>
          ) : null
        }
      />

      <Tabs
        active="/time-off/requests"
        tabs={[
          { label: 'Requests', href: '/time-off/requests' },
          { label: 'Allocations', href: '/time-off/allocations' },
          { label: 'Time Off Types', href: '/time-off/types' },
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Awaiting Approval"
          value={countFor('TO_APPROVE')}
          tone={countFor('TO_APPROVE') > 0 ? 'warning' : 'default'}
        />
        <KpiCard label="Approved" value={countFor('APPROVED')} tone="positive" />
        <KpiCard label="Refused" value={countFor('REFUSED')} />
        <KpiCard label="Cancelled" value={countFor('CANCELLED')} />
      </div>

      <ListFilters
        search={{ value: params.q ?? '', placeholder: 'Search employee…' }}
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: params.status ?? '',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'TO_APPROVE', label: 'To approve' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REFUSED', label: 'Refused' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
          {
            name: 'type',
            label: 'Type',
            value: params.type ?? '',
            options: [
              { value: '', label: 'All types' },
              ...types.map((t) => ({ value: t.id, label: t.name })),
            ],
          },
        ]}
      />

      {requests.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No time off requests"
            description="Requests appear here once employees file them."
            action={
              canCreate ? (
                <Link href="/time-off/requests/new" className="btn-primary">
                  New Request
                </Link>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Duration</th>
                <th>Allocation</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const { first, last } = splitName(r.employee?.fullName ?? '');
                return (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/employees/${r.employeeId}`}
                        className="flex items-center gap-2.5 hover:text-brand-700"
                      >
                        <Avatar firstName={first} lastName={last} size="sm" seed={r.employeeId} />
                        <span>
                          <span className="block font-medium text-slate-900">
                            {r.employee?.fullName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {r.employee?.department ?? '—'}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: `${r.type.colorHex}18`, color: r.type.colorHex }}
                      >
                        {r.type.name}
                      </span>
                    </td>
                    <td>{formatDate(r.dateFrom)}</td>
                    <td>{formatDate(r.dateTo)}</td>
                    <td className="font-medium">
                      {r.duration} {r.type.unit === 'DAY' ? 'day(s)' : 'hr(s)'}
                    </td>
                    <td>
                      {r.allocationId ? (
                        <Badge tone="emerald">Consumed</Badge>
                      ) : r.type.requiresAllocation ? (
                        <span className="text-xs text-slate-400">Not linked</span>
                      ) : (
                        <span className="text-xs text-slate-400">Not required</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <Link
                        href={`/time-off/requests/${r.id}`}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        {canApprove && r.status === 'TO_APPROVE' ? 'Review' : 'Open'}
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
