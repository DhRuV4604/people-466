import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  can,
  type LeaveAllocationDto,
  type TimeOffTypeDto,
  type EmployeeDetailDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch } from '@/lib/api-client';
import { formatDate, splitName } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, EmptyState, Tabs, ProgressBar } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ employee?: string; status?: string; type?: string }>;
}

export default async function AllocationsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;

  const [allocations, types, employee] = await Promise.all([
    apiGet<LeaveAllocationDto[]>('/time-off/allocations', {
      employeeId: params.employee,
      status: params.status,
      typeId: params.type,
    }),
    apiGet<TimeOffTypeDto[]>('/time-off/types'),
    params.employee
      ? apiFetch<EmployeeDetailDto | null>(`/employees/${params.employee}`, { nullOn404: true })
      : Promise.resolve(null),
  ]);

  const canCreate = can(session.role, 'timeOffAllocations', 'create');

  return (
    <>
      <PageHeader
        title="Leave Allocations"
        subtitle={
          employee
            ? `Allocations for ${employee.fullName}`
            : `${allocations.length} allocation${allocations.length === 1 ? '' : 's'}`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: employee.fullName, href: `/employees/${employee.id}` },
                { label: 'Allocations', href: `/time-off/allocations?employee=${employee.id}` },
              ]
            : undefined
        }
        actions={
          canCreate ? (
            <Link
              href={`/time-off/allocations/new${params.employee ? `?employee=${params.employee}` : ''}`}
              className="btn-primary"
            >
              New Allocation
            </Link>
          ) : null
        }
      />

      <Tabs
        active="/time-off/allocations"
        tabs={[
          { label: 'Requests', href: '/time-off/requests' },
          { label: 'Allocations', href: '/time-off/allocations' },
          { label: 'Time Off Types', href: '/time-off/types' },
        ]}
      />

      <ListFilters
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: params.status ?? '',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'DRAFT', label: 'Awaiting approval' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REFUSED', label: 'Refused' },
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

      {allocations.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No allocations"
            description="Allocations grant the balance that leave requests draw from."
            action={
              canCreate ? (
                <Link href="/time-off/allocations/new" className="btn-primary">
                  New Allocation
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
                <th>Allocated</th>
                <th>Taken</th>
                <th>Remaining</th>
                <th>Validity</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => {
                const unit = a.type.unit === 'DAY' ? 'd' : 'h';
                const { first, last } = splitName(a.employee?.fullName ?? '');
                return (
                  <tr key={a.id}>
                    <td>
                      <Link
                        href={`/employees/${a.employeeId}`}
                        className="flex items-center gap-2.5 hover:text-brand-700"
                      >
                        <Avatar firstName={first} lastName={last} size="sm" seed={a.employeeId} />
                        <span>
                          <span className="block font-medium text-slate-900">
                            {a.employee?.fullName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {a.employee?.department ?? '—'}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ background: `${a.type.colorHex}18`, color: a.type.colorHex }}
                      >
                        {a.type.name}
                      </span>
                    </td>
                    <td className="font-semibold">
                      {a.quantity}
                      {unit}
                    </td>
                    <td>
                      {a.taken}
                      {unit}
                    </td>
                    <td>
                      <div className="w-28">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span
                            className={
                              a.remaining <= 0
                                ? 'font-semibold text-red-600'
                                : 'font-semibold text-slate-900'
                            }
                          >
                            {a.remaining}
                            {unit}
                          </span>
                        </div>
                        <ProgressBar
                          value={a.taken}
                          max={a.quantity || 1}
                          colorHex={a.type.colorHex}
                        />
                      </div>
                    </td>
                    <td className="text-xs">
                      {formatDate(a.validFrom)} —{' '}
                      {a.validTo ? formatDate(a.validTo) : <span className="text-slate-400">open</span>}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <Link
                        href={`/time-off/allocations/${a.id}`}
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
