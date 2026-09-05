import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatMoney, formatHours } from '@/lib/utils';
import { isNegativeCategory, CATEGORY_LABELS } from '@/lib/payroll';
import {
  PageHeader,
  StatusBadge,
  Avatar,
  Field,
  AlertBanner,
  Badge,
} from '@/components/ui';
import { PayslipActions } from './payslip-actions';

export const dynamic = 'force-dynamic';

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');

  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true, jobPosition: true } },
      payrun: true,
      contract: true,
      structure: true,
      lines: { orderBy: { sequence: 'asc' } },
      emails: { orderBy: { sentAt: 'desc' }, take: 3 },
    },
  });

  if (!payslip) notFound();

  // An employee may open only their own payslip; other roles need the permission.
  const isOwn = session.employeeId === payslip.employeeId;
  if (!can(session.role, 'payslips', 'read') && !isOwn) redirect('/my-space');

  const warnings: string[] = JSON.parse(payslip.warnings || '[]');

  const earnings = payslip.lines.filter((l) => !isNegativeCategory(l.category) && l.category !== 'NET' && l.category !== 'GROSS');
  const deductions = payslip.lines.filter((l) => isNegativeCategory(l.category));
  const grossLine = payslip.lines.find((l) => l.category === 'GROSS');
  const netLine = payslip.lines.find((l) => l.category === 'NET');

  const canUpdate = can(session.role, 'payslips', 'update');

  return (
    <>
      <PageHeader
        title={`Payslip ${payslip.number}`}
        subtitle={`${payslip.employee.firstName} ${payslip.employee.lastName} · ${formatDate(payslip.periodStart)} — ${formatDate(payslip.periodEnd)}`}
        breadcrumb={[
          { label: 'Payslips', href: '/payroll/payslips' },
          { label: payslip.number, href: `/payroll/payslips/${id}` },
        ]}
        actions={
          <PayslipActions
            id={id}
            status={payslip.status}
            canRecompute={canUpdate && payslip.status !== 'PAID'}
          />
        }
      />

      {warnings.length > 0 && (
        <div className="mb-5 no-print">
          <AlertBanner tone="warning" title="Computation warnings" items={warnings} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Salary computation */}
        <div className="lg:col-span-2">
          <div className="card print-sheet p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-center gap-3">
                <Avatar
                  firstName={payslip.employee.firstName}
                  lastName={payslip.employee.lastName}
                  size="lg"
                  seed={payslip.employeeId}
                />
                <div>
                  <p className="font-bold text-slate-900">
                    {payslip.employee.firstName} {payslip.employee.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {payslip.employee.jobPosition?.name ?? '—'} ·{' '}
                    {payslip.employee.department?.name ?? '—'}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {payslip.employee.employeeCode}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold text-slate-900">{payslip.number}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(payslip.periodStart)} — {formatDate(payslip.periodEnd)}
                </p>
                <div className="mt-1.5">
                  <StatusBadge status={payslip.status} />
                </div>
              </div>
            </div>

            <h3 className="mb-3 text-sm font-semibold text-slate-900">Salary Computation</h3>

            {payslip.lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                Not computed yet. Run Compute on the parent pay run to generate the breakdown.
              </p>
            ) : (
              <div className="space-y-5">
                {/* Earnings */}
                <div>
                  <p className="section-title mb-2">Earnings</p>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Category</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Rate</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earnings.map((l) => (
                          <tr key={l.id}>
                            <td className="font-medium text-slate-900">{l.name}</td>
                            <td>
                              <Badge tone={l.category === 'BASIC' ? 'violet' : 'emerald'}>
                                {CATEGORY_LABELS[l.category] ?? l.category}
                              </Badge>
                            </td>
                            <td className="text-right text-xs">{l.quantity}</td>
                            <td className="text-right text-xs">
                              {l.rate !== 100 ? `${l.rate}%` : '—'}
                            </td>
                            <td className="text-right font-semibold text-slate-900">
                              {formatMoney(l.amount)}
                            </td>
                          </tr>
                        ))}
                        {grossLine && (
                          <tr className="bg-blue-50/50">
                            <td className="font-bold text-slate-900">{grossLine.name}</td>
                            <td>
                              <Badge tone="blue">Gross</Badge>
                            </td>
                            <td colSpan={2}></td>
                            <td className="text-right font-bold text-slate-900">
                              {formatMoney(grossLine.amount)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Deductions */}
                {deductions.length > 0 && (
                  <div>
                    <p className="section-title mb-2">Deductions</p>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Category</th>
                            <th className="text-right">Rate</th>
                            <th className="text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deductions.map((l) => (
                            <tr key={l.id}>
                              <td className="font-medium text-slate-900">{l.name}</td>
                              <td>
                                <Badge tone={l.category === 'DEDUCTION' ? 'red' : 'amber'}>
                                  {CATEGORY_LABELS[l.category] ?? l.category}
                                </Badge>
                              </td>
                              <td className="text-right text-xs">
                                {l.rate !== 100 ? `${l.rate}%` : '—'}
                              </td>
                              <td className="text-right font-semibold text-red-600">
                                -{formatMoney(l.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <TotalRow label="Basic" value={formatMoney(payslip.basicWage)} />
                  <TotalRow label="Gross Pay" value={formatMoney(payslip.grossPay)} />
                  <TotalRow
                    label="Total Deductions"
                    value={`-${formatMoney(payslip.totalDeductions)}`}
                    tone="danger"
                  />
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-brand-600 px-4 py-3">
                    <span className="text-sm font-bold text-white">
                      {netLine?.name ?? 'NET PAY'}
                    </span>
                    <span className="text-lg font-bold text-white">
                      {formatMoney(payslip.netPay)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5 no-print">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Payslip Details</h3>
            <dl className="space-y-3.5">
              <Field label="Employee">
                <Link
                  href={`/employees/${payslip.employeeId}`}
                  className="text-brand-600 hover:underline"
                >
                  {payslip.employee.firstName} {payslip.employee.lastName}
                </Link>
              </Field>
              <Field label="Salary Structure">
                <Link
                  href={`/payroll/structures/${payslip.structureId}`}
                  className="text-brand-600 hover:underline"
                >
                  {payslip.structure.name}
                </Link>
              </Field>
              <Field label="Pay Run">
                {payslip.payrun ? (
                  <Link
                    href={`/payroll/payruns/${payslip.payrunId}`}
                    className="text-brand-600 hover:underline"
                  >
                    {payslip.payrun.name}
                  </Link>
                ) : (
                  'Standalone'
                )}
              </Field>
              <Field label="Applied Contract">
                {payslip.contract ? (
                  <Link
                    href={`/contracts/${payslip.contractId}`}
                    className="text-brand-600 hover:underline"
                  >
                    {payslip.contract.name}
                  </Link>
                ) : (
                  <span className="text-amber-600">No contract resolved</span>
                )}
              </Field>
              <Field label="Period">
                {formatDate(payslip.periodStart)} — {formatDate(payslip.periodEnd)}
              </Field>
              <Field label="Status">
                <StatusBadge status={payslip.status} />
              </Field>
            </dl>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Worked Time</h3>
            <dl className="space-y-3.5">
              <Field label="Worked Days">{payslip.workedDays}</Field>
              <Field label="Worked Hours">{formatHours(payslip.workedHours)}</Field>
              <Field label="Overtime">{formatHours(payslip.overtimeHours)}</Field>
              <Field label="Approved Leave">{payslip.leaveDays} day(s)</Field>
            </dl>
          </div>

          {payslip.emails.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Delivery</h3>
              <div className="space-y-2">
                {payslip.emails.map((e) => (
                  <div key={e.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-slate-600">{e.toEmail}</span>
                      <StatusBadge status={e.status === 'SENT' ? 'APPROVED' : 'REFUSED'} />
                    </div>
                    {e.attachmentName && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {e.attachmentName}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TotalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${tone === 'danger' ? 'text-red-600' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}
