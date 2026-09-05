import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatMoney } from '@/lib/utils';
import { PageHeader, Field, StatusBadge, Badge } from '@/components/ui';
import { RuleEditor } from '@/components/rule-editor';
import { StructureForm } from '../structure-form';

export const dynamic = 'force-dynamic';

export default async function StructureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'salaryStructures', 'read')) redirect('/dashboard');

  const structure = await prisma.salaryStructure.findUnique({
    where: { id },
    include: {
      rules: { orderBy: { sequence: 'asc' } },
      contracts: {
        include: { employee: true },
        take: 8,
        orderBy: { dateStart: 'desc' },
      },
      payruns: { orderBy: { periodStart: 'desc' }, take: 5 },
      _count: { select: { rules: true, contracts: true, payslips: true } },
    },
  });

  if (!structure) notFound();

  const canUpdate = can(session.role, 'salaryStructures', 'update');
  const canManageRules = can(session.role, 'salaryRules', 'create');

  return (
    <>
      <PageHeader
        title={structure.name}
        subtitle={structure.description ?? 'Salary structure'}
        breadcrumb={[
          { label: 'Salary Structures', href: '/payroll/structures' },
          { label: structure.name, href: `/payroll/structures/${id}` },
        ]}
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="section-title">Rules</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{structure._count.rules}</p>
        </div>
        <div className="card p-4">
          <p className="section-title">Contracts Using It</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{structure._count.contracts}</p>
        </div>
        <div className="card p-4">
          <p className="section-title">Payslips Produced</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{structure._count.payslips}</p>
        </div>
        <div className="card p-4">
          <p className="section-title">Status</p>
          <p className="mt-2">
            <StatusBadge status={structure.active ? 'ACTIVE' : 'INACTIVE'} />
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <RuleEditor
            structureId={id}
            rules={structure.rules}
            canManage={canManageRules}
            canDelete={can(session.role, 'salaryRules', 'delete')}
          />
        </div>

        <div className="space-y-5">
          <StructureForm structure={structure} readOnly={!canUpdate} canDelete={can(session.role, 'salaryStructures', 'delete')} />

          {structure.payruns.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Pay Runs</h3>
              <div className="space-y-2">
                {structure.payruns.map((p) => (
                  <Link
                    key={p.id}
                    href={`/payroll/payruns/${p.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
                  >
                    <span className="truncate text-slate-600">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {structure.contracts.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned Contracts</h3>
              <div className="space-y-2">
                {structure.contracts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contracts/${c.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
                  >
                    <span className="truncate text-slate-700">
                      {c.employee.firstName} {c.employee.lastName}
                    </span>
                    <span className="font-medium text-slate-900">{formatMoney(c.wage)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
