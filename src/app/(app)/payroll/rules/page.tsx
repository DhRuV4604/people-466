import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatMoney } from '@/lib/utils';
import { PageHeader, EmptyState, Badge } from '@/components/ui';
import { ListFilters } from '@/components/list-filters';

export const dynamic = 'force-dynamic';

const CATEGORY_TONES: Record<string, 'violet' | 'emerald' | 'blue' | 'red' | 'amber' | 'slate'> = {
  BASIC: 'violet',
  ALLOWANCE: 'emerald',
  GROSS: 'blue',
  DEDUCTION: 'red',
  CONTRIBUTION: 'amber',
  NET: 'blue',
};

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ structure?: string; category?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'salaryRules', 'read')) redirect('/dashboard');

  const params = await searchParams;

  const [rules, structures] = await Promise.all([
    prisma.salaryRule.findMany({
      where: {
        ...(params.structure ? { structureId: params.structure } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.q
          ? { OR: [{ name: { contains: params.q } }, { code: { contains: params.q } }] }
          : {}),
      },
      include: { structure: true },
      orderBy: [{ structure: { name: 'asc' } }, { sequence: 'asc' }],
    }),
    prisma.salaryStructure.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <>
      <PageHeader
        title="Salary Rules"
        subtitle="All rules across structures. Rules are edited within their parent structure so sequencing stays visible."
      />

      <ListFilters
        search={{ value: params.q ?? '', placeholder: 'Search rule name or code…' }}
        selects={[
          {
            name: 'structure',
            label: 'Structure',
            value: params.structure ?? '',
            options: [
              { value: '', label: 'All structures' },
              ...structures.map((s) => ({ value: s.id, label: s.name })),
            ],
          },
          {
            name: 'category',
            label: 'Category',
            value: params.category ?? '',
            options: [
              { value: '', label: 'All categories' },
              { value: 'BASIC', label: 'Basic' },
              { value: 'ALLOWANCE', label: 'Allowance' },
              { value: 'GROSS', label: 'Gross' },
              { value: 'DEDUCTION', label: 'Deduction' },
              { value: 'CONTRIBUTION', label: 'Contribution' },
              { value: 'NET', label: 'Net' },
            ],
          },
        ]}
      />

      {rules.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No salary rules"
            description="Add rules from inside a salary structure."
          />
        </div>
      ) : (
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Structure</th>
                <th className="w-16">Seq</th>
                <th>Rule</th>
                <th>Code</th>
                <th>Category</th>
                <th>Computation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                  <td>
                    <Link
                      href={`/payroll/structures/${r.structureId}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      {r.structure.name}
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-slate-500">{r.sequence}</td>
                  <td>
                    <span className="font-medium text-slate-900">{r.name}</span>
                    {r.condition && (
                      <p className="mt-0.5 font-mono text-[11px] text-amber-700">if ({r.condition})</p>
                    )}
                  </td>
                  <td>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                      {r.code}
                    </code>
                  </td>
                  <td>
                    <Badge tone={CATEGORY_TONES[r.category] ?? 'slate'}>{r.category}</Badge>
                  </td>
                  <td className="max-w-xs">
                    {r.computeType === 'FIXED' ? (
                      formatMoney(r.amountFixed ?? 0)
                    ) : r.computeType === 'PERCENTAGE' ? (
                      <span className="text-sm">
                        {r.amountPercentage}% of{' '}
                        <code className="font-mono text-xs">{r.percentageBase}</code>
                      </span>
                    ) : (
                      <code className="block break-words rounded bg-slate-100 px-1.5 py-1 font-mono text-[11px]">
                        {r.formula}
                      </code>
                    )}
                  </td>
                  <td>
                    <Badge tone={r.active ? 'emerald' : 'slate'}>
                      {r.active ? 'Active' : 'Inactive'}
                    </Badge>
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
