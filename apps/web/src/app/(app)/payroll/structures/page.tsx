import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, type SalaryStructureDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGetOrRedirect } from '@/lib/api-client';
import { PageHeader, EmptyState, Badge, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function StructuresPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const structures = await apiGetOrRedirect<SalaryStructureDto[]>(
    '/salary-structures',
    '/my-space'
  );

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
                    <Badge tone="violet">{s.counts?.rules ?? 0}</Badge>
                  </td>
                  <td>{s.counts?.contracts ?? 0}</td>
                  <td>{s.counts?.payslips ?? 0}</td>
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
