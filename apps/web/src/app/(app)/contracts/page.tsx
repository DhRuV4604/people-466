import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, type ContractDto, type EmployeeDetailDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch } from '@/lib/api-client';
import { formatDate, formatMoney, splitName } from '@/lib/utils';
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

  const params = await searchParams;

  const [contracts, employee] = await Promise.all([
    apiGet<ContractDto[]>('/contracts', {
      employeeId: params.employee,
      status: params.status,
      expiring: params.expiring ? 'true' : undefined,
      q: params.q,
    }),
    params.employee
      ? apiFetch<EmployeeDetailDto | null>(`/employees/${params.employee}`, { nullOn404: true })
      : Promise.resolve(null),
  ]);

  const canCreate = can(session.role, 'contracts', 'create');

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle={
          employee
            ? `Contracts for ${employee.fullName}`
            : `${contracts.length} contract${contracts.length === 1 ? '' : 's'}${
                params.expiring ? ' expiring within 30 days' : ''
              }`
        }
        breadcrumb={
          employee
            ? [
                { label: 'Employees', href: '/employees' },
                { label: employee.fullName, href: `/employees/${employee.id}` },
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
                const { first, last } = splitName(c.employee?.fullName ?? '');
                return (
                  <tr
                    key={c.id}
                    className={c.isApplicableForPeriod ? 'bg-emerald-50/40 hover:bg-emerald-50' : undefined}
                  >
                    <td>
                      <Link
                        href={`/employees/${c.employeeId}`}
                        className="flex items-center gap-2.5 hover:text-brand-700"
                      >
                        <Avatar firstName={first} lastName={last} size="sm" seed={c.employeeId} />
                        <span>
                          <span className="block font-medium text-slate-900">
                            {c.employee?.fullName}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {c.employee?.department ?? '—'}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/contracts/${c.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {c.name}
                      </Link>
                      {c.isApplicableForPeriod && (
                        <Badge tone="emerald" className="ml-2">
                          Active for period
                        </Badge>
                      )}
                    </td>
                    <td>{formatDate(c.dateStart)}</td>
                    <td>
                      {c.dateEnd ? (
                        formatDate(c.dateEnd)
                      ) : (
                        <span className="text-slate-400">Open ended</span>
                      )}
                    </td>
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
