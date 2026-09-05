import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, EmptyState, Badge, Tabs, KpiCard } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    employee?: string;
    status?: string;
    type?: string;
    q?: string;
  }>;
}

export default async function LeaveRequestsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffRequests', 'read')) redirect('/my-space');

  const params = await searchParams;

  const ownScope =
    session.role === 'EMPLOYEE' ? { employeeId: session.employeeId ?? '__none__' } : {};

  const where = {
    ...ownScope,
    ...(params.employee ? { employeeId: params.employee } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.type ? { typeId: params.type } : {}),
    ...(params.q
      ? {
          OR: [
            { employee: { firstName: { contains: params.q } } },
            { employee: { lastName: { contains: params.q } } },
          ],
        }
      : {}),
  };

  const [requests, types, employee, counts] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        type: true,
        allocation: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    }),
    prisma.timeOffType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    params.employee
      ? prisma.employee.findUnique({ where: { id: params.employee } })
      : Promise.resolve(null),
    prisma.leaveRequest.groupBy({
      by: ['status'],
      where: ownScope,
      _count: true,
    }),
  ]);

  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count ?? 0;

  const canCreate = can(session.role, 'timeOffRequests', 'create');
  const canApprove = can(session.role, 'timeOffRequests', 'approve');

  return (
    <>
      <PageHeader
        title="Time Off Requests"
        subtitle={
          employee
            ? `Requests for ${employee.firstName} ${employee.lastName}`
            : `${requests.length} request${requests.length === 1 ? '' : 's'}`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: `${employee.firstName} ${employee.lastName}`, href: `/employees/${employee.id}` },
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
              {requests.map((r) => (
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
