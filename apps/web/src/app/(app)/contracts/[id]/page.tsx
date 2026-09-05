import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  can,
  type ContractDto,
  type PayslipDto,
  type EmployeeSummaryDto,
  type JobPositionDto,
  type WorkingScheduleDto,
  type SalaryStructureDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch, ApiError } from '@/lib/api-client';
import { formatDate, formatMoney, splitName } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, AlertBanner, Badge } from '@/components/ui';
import { ContractForm } from '@/components/contract-form';
import { updateContractAction } from '../actions';
import { DeleteContractButton } from './delete-button';

export const dynamic = 'force-dynamic';

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');

  const contract = await apiFetch<ContractDto | null>(`/contracts/${id}`, {
    nullOn404: true,
  }).catch((err) => {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/my-space');
    throw err;
  });

  if (!contract) notFound();

  const canReadPayslips = can(session.role, 'payslips', 'read');

  const [siblings, employees, positions, schedules, structures, payslips] = await Promise.all([
    apiGet<ContractDto[]>('/contracts', { employeeId: contract.employeeId }),
    apiGet<EmployeeSummaryDto[]>('/employees', { status: 'ACTIVE' }),
    apiGet<JobPositionDto[]>('/job-positions'),
    apiGet<WorkingScheduleDto[]>('/working-schedules'),
    can(session.role, 'salaryStructures', 'read')
      ? apiGet<SalaryStructureDto[]>('/salary-structures')
      : Promise.resolve([] as SalaryStructureDto[]),
    canReadPayslips
      ? apiGet<PayslipDto[]>('/payslips', { employeeId: contract.employeeId, limit: 6 })
      : Promise.resolve([] as PayslipDto[]),
  ]);

  const applicable = siblings.find((s) => s.isApplicableForPeriod) ?? null;
  const isApplicable = applicable?.id === contract.id;
  const { first, last } = splitName(contract.employee?.fullName ?? '');

  const notices: string[] = [];
  if (contract.status === 'RUNNING' && !isApplicable && applicable) {
    notices.push(
      `Another contract (${applicable.name}) currently governs this period; payroll will use that one.`
    );
  }
  if (contract.dateEnd && new Date(contract.dateEnd) < new Date() && contract.status === 'RUNNING') {
    notices.push('This contract has passed its end date but is still marked Running.');
  }

  // Only payslips produced under this specific contract.
  const contractPayslips = payslips.filter((p) => p.contractId === contract.id);

  return (
    <>
      <PageHeader
        title={contract.name}
        subtitle={`${contract.employee?.fullName} · ${formatMoney(contract.wage)} / month`}
        breadcrumb={[
          { label: 'Contracts', href: '/contracts' },
          { label: contract.name, href: `/contracts/${id}` },
        ]}
        actions={
          can(session.role, 'contracts', 'delete') ? (
            <DeleteContractButton id={id} name={contract.name} />
          ) : null
        }
      />

      {notices.length > 0 && (
        <div className="mb-5">
          <AlertBanner tone="warning" title="Contract notice" items={notices} />
        </div>
      )}

      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <Link href={`/employees/${contract.employeeId}`} className="flex items-center gap-3">
          <Avatar firstName={first} lastName={last} size="lg" seed={contract.employeeId} />
          <div>
            <p className="font-semibold text-slate-900">{contract.employee?.fullName}</p>
            <p className="text-xs text-slate-500">{contract.employee?.department ?? '—'}</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={contract.status} />
          {isApplicable && <Badge tone="emerald">Active for current period</Badge>}
          <Badge tone="slate">{contract.contractType.replace('_', ' ')}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContractForm
            action={updateContractAction}
            contract={contract}
            employees={employees}
            positions={positions}
            schedules={schedules}
            structures={structures}
            submitLabel="Save Contract"
            cancelHref="/contracts"
            lockEmployee
            readOnly={!can(session.role, 'contracts', 'update')}
          />
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Contract History</h3>
            <div className="space-y-2">
              {siblings.map((s) => (
                <Link
                  key={s.id}
                  href={`/contracts/${s.id}`}
                  className={`block rounded-lg border px-3 py-2 transition ${
                    s.id === contract.id
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-slate-900">{s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatDate(s.dateStart)} — {s.dateEnd ? formatDate(s.dateEnd) : 'open'} ·{' '}
                    {formatMoney(s.wage)}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {contractPayslips.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Payslips</h3>
              <div className="space-y-2">
                {contractPayslips.map((p) => (
                  <Link
                    key={p.id}
                    href={`/payroll/payslips/${p.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50"
                  >
                    <span className="text-slate-600">{formatDate(p.periodStart)}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{formatMoney(p.netPay)}</span>
                      <StatusBadge status={p.status} />
                    </span>
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
