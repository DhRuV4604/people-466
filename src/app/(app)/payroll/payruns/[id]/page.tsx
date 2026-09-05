import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatDateTime, formatMoney, round2 } from '@/lib/utils';
import { detectPayrunWarnings } from '@/lib/payroll';
import {
  PageHeader,
  StatusBadge,
  Avatar,
  Field,
  AlertBanner,
  KpiCard,
  EmptyState,
} from '@/components/ui';
import { PayrunActions } from './payrun-actions';

export const dynamic = 'force-dynamic';

export default async function PayrunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'payruns', 'read')) redirect('/dashboard');

  const payrun = await prisma.payrun.findUnique({
    where: { id },
    include: {
      structure: true,
      payslips: {
        include: { employee: { include: { department: true } } },
        orderBy: { employee: { firstName: 'asc' } },
      },
      emails: { orderBy: { sentAt: 'desc' }, take: 5 },
    },
  });

  if (!payrun) notFound();

  const warnings = await detectPayrunWarnings(id);

  const totalNet = round2(payrun.payslips.reduce((s, p) => s + p.netPay, 0));
  const totalGross = round2(payrun.payslips.reduce((s, p) => s + p.grossPay, 0));
  const totalDeductions = round2(payrun.payslips.reduce((s, p) => s + p.totalDeductions, 0));

  const canUpdate = can(session.role, 'payruns', 'update');
  const canDelete = can(session.role, 'payruns', 'delete');

  return (
    <>
      <PageHeader
        title={payrun.name}
        subtitle={`${payrun.structure.name} · ${formatDate(payrun.periodStart)} — ${formatDate(payrun.periodEnd)}`}
        breadcrumb={[
          { label: 'Pay Runs', href: '/payroll/payruns' },
          { label: payrun.name, href: `/payroll/payruns/${id}` },
        ]}
        actions={
          <PayrunActions
            id={id}
            status={payrun.status}
            canUpdate={canUpdate}
            canDelete={canDelete}
            hasPayslips={payrun.payslips.length > 0}
          />
        }
      />

      {/* Warnings must be visible before validation (spec B6) */}
      {warnings.length > 0 && payrun.status !== 'PAID' && (
        <div className="mb-5">
          <AlertBanner
            tone="warning"
            title={`${warnings.length} issue${warnings.length === 1 ? '' : 's'} to review before finalising`}
            items={warnings}
          />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Status" value={payrun.status} />
        <KpiCard label="Payslips" value={payrun.payslips.length} />
        <KpiCard label="Total Gross" value={formatMoney(totalGross)} />
        <KpiCard label="Deductions" value={formatMoney(totalDeductions)} tone="danger" />
        <KpiCard label="Total Net" value={formatMoney(totalNet)} tone="positive" />
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">
              Payslips ({payrun.payslips.length})
            </h3>

            {payrun.payslips.length === 0 ? (
              <EmptyState title="No payslips in this run" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Number</th>
                      <th>Worked</th>
                      <th>Basic</th>
                      <th>Gross</th>
                      <th>Deductions</th>
                      <th>Net</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrun.payslips.map((p) => {
                      const slipWarnings: string[] = JSON.parse(p.warnings || '[]');
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link
                              href={`/employees/${p.employeeId}`}
                              className="flex items-center gap-2.5 hover:text-brand-700"
                            >
                              <Avatar
                                firstName={p.employee.firstName}
                                lastName={p.employee.lastName}
                                size="sm"
                                seed={p.employeeId}
                              />
                              <span>
                                <span className="block font-medium text-slate-900">
                                  {p.employee.firstName} {p.employee.lastName}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  {p.employee.department?.name ?? '—'}
                                </span>
                              </span>
                            </Link>
                            {slipWarnings.length > 0 && (
                              <p className="mt-1 text-[11px] text-amber-700">
                                {slipWarnings.length} warning(s)
                              </p>
                            )}
                          </td>
                          <td className="font-mono text-xs">{p.number}</td>
                          <td className="text-xs">
                            {p.workedDays}d
                            {p.overtimeHours > 0 && (
                              <span className="ml-1 text-emerald-600">+{p.overtimeHours}h OT</span>
                            )}
                          </td>
                          <td>{formatMoney(p.basicWage)}</td>
                          <td>{formatMoney(p.grossPay)}</td>
                          <td className="text-red-600">-{formatMoney(p.totalDeductions)}</td>
                          <td className="font-semibold text-slate-900">{formatMoney(p.netPay)}</td>
                          <td>
                            <StatusBadge status={p.status} />
                          </td>
                          <td>
                            <Link
                              href={`/payroll/payslips/${p.id}`}
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
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Run Details</h3>
            <dl className="space-y-3.5">
              <Field label="Status">
                <StatusBadge status={payrun.status} />
              </Field>
              <Field label="Salary Structure">
                <Link
                  href={`/payroll/structures/${payrun.structureId}`}
                  className="text-brand-600 hover:underline"
                >
                  {payrun.structure.name}
                </Link>
              </Field>
              <Field label="Period">
                {formatDate(payrun.periodStart)} — {formatDate(payrun.periodEnd)}
              </Field>
              <Field label="Created">{formatDateTime(payrun.createdAt)}</Field>
              {payrun.computedAt && (
                <Field label="Computed">{formatDateTime(payrun.computedAt)}</Field>
              )}
              {payrun.validatedAt && (
                <Field label="Validated">{formatDateTime(payrun.validatedAt)}</Field>
              )}
              {payrun.paidAt && (
                <Field label="Paid">
                  {formatDateTime(payrun.paidAt)}
                  {payrun.paidBy && ` by ${payrun.paidBy}`}
                </Field>
              )}
            </dl>
          </div>

          {payrun.emails.length > 0 && (
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Recent Deliveries</h3>
                <Link href="/payroll/outbox" className="text-xs font-medium text-brand-600 hover:underline">
                  Outbox
                </Link>
              </div>
              <div className="space-y-2">
                {payrun.emails.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600">{e.toEmail}</span>
                    <StatusBadge status={e.status === 'SENT' ? 'APPROVED' : 'REFUSED'} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Processing Steps</h3>
            <ol className="space-y-2 text-xs">
              <Step
                label="Compute"
                description="Pull contract, attendance and leave, then run the structure's rules."
                done={['COMPUTED', 'VALIDATED', 'PAID'].includes(payrun.status)}
              />
              <Step
                label="Validate"
                description="Blocked while warnings remain unresolved."
                done={['VALIDATED', 'PAID'].includes(payrun.status)}
              />
              <Step
                label="Mark Paid"
                description="Locks the run as a historical record."
                done={payrun.status === 'PAID'}
              />
              <Step
                label="Send Payslips"
                description="Emails each employee their payslip PDF."
                done={payrun.emails.length > 0}
              />
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function Step({
  label,
  description,
  done,
}: {
  label: string;
  description: string;
  done: boolean;
}) {
  return (
    <li className="flex gap-2.5">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
          done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
        }`}
      >
        {done ? '✓' : '·'}
      </span>
      <span>
        <span className={`font-medium ${done ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
        <span className="block text-slate-400">{description}</span>
      </span>
    </li>
  );
}
