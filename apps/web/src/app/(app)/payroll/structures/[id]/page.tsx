import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  can,
  type SalaryStructureDto,
  type PayrunDto,
  type ContractDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch, ApiError } from '@/lib/api-client';
import { formatMoney } from '@/lib/utils';
import { PageHeader, StatusBadge } from '@/components/ui';
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

  const structure = await apiFetch<SalaryStructureDto | null>(`/salary-structures/${id}`, {
    nullOn404: true,
  }).catch((err) => {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/my-space');
    throw err;
  });

  if (!structure) notFound();

  const [payruns, contracts] = await Promise.all([
    can(session.role, 'payruns', 'read')
      ? apiGet<PayrunDto[]>('/payruns')
      : Promise.resolve([] as PayrunDto[]),
    apiGet<ContractDto[]>('/contracts'),
  ]);

  const relatedPayruns = payruns.filter((p) => p.structureId === id).slice(0, 5);
  const relatedContracts = contracts.filter((c) => c.salaryStructureId === id).slice(0, 8);

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
          <p className="mt-1 text-2xl font-bold text-slate-900">{structure.counts?.rules ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="section-title">Contracts Using It</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {structure.counts?.contracts ?? 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="section-title">Payslips Produced</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {structure.counts?.payslips ?? 0}
          </p>
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
            rules={structure.rules ?? []}
            canManage={canManageRules}
            canDelete={can(session.role, 'salaryRules', 'delete')}
          />
        </div>

        <div className="space-y-5">
          <StructureForm
            structure={structure}
            readOnly={!canUpdate}
            canDelete={can(session.role, 'salaryStructures', 'delete')}
          />

          {relatedPayruns.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Pay Runs</h3>
              <div className="space-y-2">
                {relatedPayruns.map((p) => (
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

          {relatedContracts.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned Contracts</h3>
              <div className="space-y-2">
                {relatedContracts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contracts/${c.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
                  >
                    <span className="truncate text-slate-700">{c.employee?.fullName}</span>
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
