import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatMoney, round2 } from '@/lib/utils';
import { PageHeader, StatusBadge, EmptyState, Badge } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

export default async function PayrunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'payruns', 'read')) redirect('/dashboard');

  const params = await searchParams;

  const payruns = await prisma.payrun.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.q ? { name: { contains: params.q } } : {}),
    },
    include: {
      structure: true,
      payslips: { select: { netPay: true, status: true } },
    },
    orderBy: [{ periodStart: 'desc' }],
  });

  const canCreate = can(session.role, 'payruns', 'create');

  return (
    <>
      <PageHeader
        title="Pay Runs"
        subtitle="A pay run groups the payslips generated for one payroll period."
        actions={
          canCreate ? (
            <Link href="/payroll/payruns/new" className="btn-primary">
              New Pay Run
            </Link>
          ) : null
        }
      />

      <ListFilters
        search={{ value: params.q ?? '', placeholder: 'Search pay run…' }}
        selects={[
          {
            name: 'status',
            label: 'Status',
            value: params.status ?? '',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'COMPUTED', label: 'Computed' },
              { value: 'VALIDATED', label: 'Validated' },
              { value: 'PAID', label: 'Paid' },
            ],
          },
        ]}
      />

      {payruns.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No pay runs"
            description="Start a pay run to generate payslips for a period."
            action={
              canCreate ? (
                <Link href="/payroll/payruns/new" className="btn-primary">
                  New Pay Run
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
                <th>Pay Run</th>
                <th>Structure</th>
                <th>Period</th>
                <th>Payslips</th>
                <th>Total Net</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payruns.map((p) => {
                const totalNet = round2(p.payslips.reduce((s, x) => s + x.netPay, 0));
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/payroll/payruns/${p.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td>{p.structure.name}</td>
                    <td className="text-xs">
                      {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                    </td>
                    <td>
                      <Badge tone="violet">{p.payslips.length}</Badge>
                    </td>
                    <td className="font-semibold text-slate-900">{formatMoney(totalNet)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td>
                      <Link
                        href={`/payroll/payruns/${p.id}`}
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
