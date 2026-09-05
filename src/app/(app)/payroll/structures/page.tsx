import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader, EmptyState, Badge, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function StructuresPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'salaryStructures', 'read')) redirect('/dashboard');

  const structures = await prisma.salaryStructure.findMany({
    include: {
      _count: { select: { rules: true, contracts: true, payslips: true } },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  const canCreate = can(session.role, 'salaryStructures', 'create');

  return (
    <>
      <PageHeader
        title="Salary Structures"
        subtitle="Containers for ordered collections of salary rules. A pay run's chosen structure decides which rules compute its payslips."
        actions={
          canCreate ? (
            <Link href="/payroll/structures/new" className="btn-primary">
              New Structure
            </Link>
          ) : null
        }
      />

      {structures.length === 0 ? (
        <EmptyState
          title="No salary structures"
          description="Create a structure, then add the rules that calculate earnings and deductions."
          action={
            canCreate ? (
              <Link href="/payroll/structures/new" className="btn-primary">
                New Structure
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Structure</th>
                <th>Code</th>
                <th>Rules</th>
                <th>Contracts</th>
                <th>Payslips</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {structures.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/payroll/structures/${s.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {s.name}
                    </Link>
                    {s.description && (
                      <p className="mt-0.5 max-w-md text-xs text-slate-500">{s.description}</p>
                    )}
                  </td>
                  <td className="font-mono text-xs">{s.code}</td>
                  <td>
                    <Badge tone="violet">{s._count.rules}</Badge>
                  </td>
                  <td>{s._count.contracts}</td>
                  <td>{s._count.payslips}</td>
                  <td>
                    <StatusBadge status={s.active ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td>
                    <Link
                      href={`/payroll/structures/${s.id}`}
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
