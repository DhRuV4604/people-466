import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatMoney, startOfMonth, endOfMonth } from '@/lib/utils';
import { resolveContractForPeriod } from '@/lib/contracts';
import { PageHeader, StatusBadge, Avatar, EmptyState, Badge } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    employee?: string;
    status?: string;
    expiring?: string;
    q?: string;
  }>;
}

export default async function ContractsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'contracts', 'read')) redirect('/my-space');

  const params = await searchParams;

  const ownScope =
    session.role === 'EMPLOYEE' ? { employeeId: session.employeeId ?? '__none__' } : {};

  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86400000);

  const where = {
    ...ownScope,
    ...(params.employee ? { employeeId: params.employee } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.expiring
      ? { status: 'RUNNING', dateEnd: { not: null, gte: now, lte: horizon } }
      : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q } },
            { employee: { firstName: { contains: params.q } } },
            { employee: { lastName: { contains: params.q } } },
          ],
        }
      : {}),
  };

  const [contracts, employee] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        employee: { include: { department: true } },
        jobPosition: true,
        salaryStructure: true,
        workingSchedule: true,
      },
      orderBy: [{ dateStart: 'desc' }],
    }),
    params.employee
      ? prisma.employee.findUnique({ where: { id: params.employee } })
      : Promise.resolve(null),
  ]);

  // Mark which contract actually governs the current period, per employee.
  const periodStart = startOfMonth(now);
  const periodEnd = endOfMonth(now);
  const byEmployee = new Map<string, typeof contracts>();
  for (const c of contracts) {
    const list = byEmployee.get(c.employeeId) ?? [];
    list.push(c);
    byEmployee.set(c.employeeId, list);
  }
  const applicableIds = new Set<string>();
  for (const list of byEmployee.values()) {
    const applicable = resolveContractForPeriod(list, periodStart, periodEnd);
    if (applicable) applicableIds.add(applicable.id);
  }

  const canCreate = can(session.role, 'contracts', 'create');

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle={
          employee
            ? `Contracts for ${employee.firstName} ${employee.lastName}`
            : `${contracts.length} contract${contracts.length === 1 ? '' : 's'}${
                params.expiring ? ' expiring within 30 days' : ''
              }`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: `${employee.firstName} ${employee.lastName}`, href: `/employees/${employee.id}` },
                { label: 'Contracts', href: `/contracts?employee=${employee.id}` },
              ]
            : undefined
        }
        actions={
          canCreate ? (
            <Link
              href={`/contracts/new${params.employee ? `?employee=${params.employee}` : ''}`}
              className="btn-primary"
            >
              New Contract
            </Link>
          ) : null
        }
      />

      <ListFilters
        search={{ value: params.q ?? '', placeholder: 'Search contract or employee…' }}
        selects={[
          {
            name: 'status',
            value: params.status ?? '',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'RUNNING', label: 'Running' },
              { value: 'EXPIRED', label: 'Expired' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
        ]}
      />

      {contracts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No contracts found"
            description="Contracts define the wage and terms payroll uses for a period."
            action={
              canCreate ? (
                <Link href="/contracts/new" className="btn-primary">
                  New Contract
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
                <th>Contract</th>
                <th>Start</th>
                <th>End</th>
                <th>Wage</th>
                <th>Structure</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const isApplicable = applicableIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={isApplicable ? 'bg-emerald-50/40 hover:bg-emerald-50' : undefined}
                  >
                    <td>
                      <Link
                        href={`/employees/${c.employeeId}`}
                        className="flex items-center gap-2.5 hover:text-brand-700"
                      >
                        <Avatar
                          firstName={c.employee.firstName}
                          lastName={c.employee.lastName}
                          size="sm"
                          seed={c.employeeId}
                        />
                        <span>
                          <span className="block font-medium text-slate-900">
                            {c.employee.firstName} {c.employee.lastName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {c.employee.department?.name ?? '—'}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.name}
                      </Link>
                      {isApplicable && (
                        <Badge tone="emerald" className="ml-2">
                          Active for period
                        </Badge>
                      )}
                    </td>
                    <td>{formatDate(c.dateStart)}</td>
                    <td>{c.dateEnd ? formatDate(c.dateEnd) : <span className="text-slate-400">Open ended</span>}</td>
                    <td className="font-semibold text-slate-900">{formatMoney(c.wage)}</td>
                    <td>{c.salaryStructure?.name ?? '—'}</td>
                    <td>
                      <Badge tone="slate">{c.contractType.replace('_', ' ')}</Badge>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
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
