import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, round2 } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, EmptyState, Tabs, ProgressBar } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ employee?: string; status?: string; type?: string; q?: string }>;
}

export default async function AllocationsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffAllocations', 'read')) redirect('/my-space');

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

  const [allocations, types, employee] = await Promise.all([
    prisma.leaveAllocation.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        type: true,
        // Approved requests are what actually consume the allocation.
        requests: { where: { status: 'APPROVED' }, select: { duration: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    }),
    prisma.timeOffType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    params.employee
      ? prisma.employee.findUnique({ where: { id: params.employee } })
      : Promise.resolve(null),
  ]);

  const canCreate = can(session.role, 'timeOffAllocations', 'create');

  return (
    <>
      <PageHeader
        title="Leave Allocations"
        subtitle={
          employee
            ? `Allocations for ${employee.firstName} ${employee.lastName}`
            : `${allocations.length} allocation${allocations.length === 1 ? '' : 's'}`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: `${employee.firstName} ${employee.lastName}`, href: `/employees/${employee.id}` },
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
        search={{ value: params.q ?? '', placeholder: 'Search employee…' }}
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
                const taken = round2(a.requests.reduce((s, r) => s + r.duration, 0));
                const remaining = round2(a.quantity - taken);
                const unit = a.type.unit === 'DAY' ? 'd' : 'h';

                return (
                  <tr key={a.id}>
                    <td>
                      <Link
                        href={`/employees/${a.employeeId}`}
                        className="flex items-center gap-2.5 hover:text-brand-700"
                      >
                        <Avatar
                          firstName={a.employee.firstName}
                          lastName={a.employee.lastName}
                          size="sm"
                          seed={a.employeeId}
                        />
                        <span>
                          <span className="block font-medium text-slate-900">
                            {a.employee.firstName} {a.employee.lastName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {a.employee.department?.name ?? '—'}
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
                      {taken}
                      {unit}
                    </td>
                    <td>
                      <div className="w-28">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span
                            className={
                              remaining <= 0 ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'
                            }
                          >
                            {remaining}
                            {unit}
                          </span>
                        </div>
                        <ProgressBar value={taken} max={a.quantity || 1} colorHex={a.type.colorHex} />
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
