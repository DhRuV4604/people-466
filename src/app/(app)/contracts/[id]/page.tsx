import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatMoney, startOfMonth, endOfMonth } from '@/lib/utils';
import { resolveContractForPeriod } from '@/lib/contracts';
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
  if (!can(session.role, 'contracts', 'read')) redirect('/my-space');

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true } },
      jobPosition: true,
      workingSchedule: true,
      salaryStructure: true,
      payslips: { include: { payrun: true }, orderBy: { periodStart: 'desc' }, take: 6 },
    },
  });

  if (!contract) notFound();
  if (session.role === 'EMPLOYEE' && session.employeeId !== contract.employeeId) {
    redirect('/my-space');
  }

  const [employees, positions, schedules, structures, siblings] = await Promise.all([
    prisma.employee.findMany({
      where: { status: { not: 'INACTIVE' } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.jobPosition.findMany({ orderBy: { name: 'asc' } }),
    prisma.workingSchedule.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.salaryStructure.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.contract.findMany({
      where: { employeeId: contract.employeeId },
      orderBy: { dateStart: 'desc' },
    }),
  ]);

  const now = new Date();
  const applicable = resolveContractForPeriod(siblings, startOfMonth(now), endOfMonth(now));
  const isApplicable = applicable?.id === contract.id;

  const notices: string[] = [];
  if (contract.status === 'RUNNING' && !isApplicable && applicable) {
    notices.push(
      `Another contract (${applicable.name}) currently governs this period; payroll will use that one.`
    );
  }
  if (contract.dateEnd && contract.dateEnd < now && contract.status === 'RUNNING') {
    notices.push('This contract has passed its end date but is still marked Running.');
  }

  const canUpdate = can(session.role, 'contracts', 'update');
  const canDelete = can(session.role, 'contracts', 'delete');

  return (
    <>
      <PageHeader
        title={contract.name}
        subtitle={`${contract.employee.firstName} ${contract.employee.lastName} · ${formatMoney(contract.wage)} / month`}
        breadcrumb={[
          { label: 'Contracts', href: '/contracts' },
          { label: contract.name, href: `/contracts/${id}` },
        ]}
        actions={
          canDelete ? <DeleteContractButton id={id} name={contract.name} /> : null
        }
      />

      {notices.length > 0 && (
        <div className="mb-5">
          <AlertBanner tone="warning" title="Contract notice" items={notices} />
        </div>
      )}

      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <Link href={`/employees/${contract.employeeId}`} className="flex items-center gap-3">
          <Avatar
            firstName={contract.employee.firstName}
            lastName={contract.employee.lastName}
            size="lg"
            seed={contract.employeeId}
          />
          <div>
            <p className="font-semibold text-slate-900">
              {contract.employee.firstName} {contract.employee.lastName}
            </p>
            <p className="text-xs text-slate-500">
              {contract.employee.department?.name ?? '—'} · {contract.employee.employeeCode}
            </p>
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
            readOnly={!canUpdate}
          />
        </div>

        <div className="space-y-5">
          {/* Contract history for this employee */}
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

          {/* Payslips produced under this contract */}
          {contract.payslips.length > 0 && can(session.role, 'payslips', 'read') && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Payslips</h3>
              <div className="space-y-2">
                {contract.payslips.map((p) => (
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
