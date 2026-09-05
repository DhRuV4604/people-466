import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatDateTime, round2 } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, Field, ProgressBar, AlertBanner } from '@/components/ui';
import { AllocationForm } from '@/components/allocation-form';
import { saveAllocationAction } from '../../actions';
import { AllocationActions } from './allocation-actions';

export const dynamic = 'force-dynamic';

export default async function AllocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffAllocations', 'read')) redirect('/my-space');

  const allocation = await prisma.leaveAllocation.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true } },
      type: true,
      requests: {
        include: { type: true },
        orderBy: { dateFrom: 'desc' },
      },
    },
  });

  if (!allocation) notFound();
  if (session.role === 'EMPLOYEE' && session.employeeId !== allocation.employeeId) {
    redirect('/my-space');
  }

  const types = await prisma.timeOffType.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

  const approved = allocation.requests.filter((r) => r.status === 'APPROVED');
  const taken = round2(approved.reduce((s, r) => s + r.duration, 0));
  const remaining = round2(allocation.quantity - taken);
  const unit = allocation.type.unit === 'DAY' ? 'day(s)' : 'hour(s)';

  const canUpdate = can(session.role, 'timeOffAllocations', 'update');
  const canApprove = can(session.role, 'timeOffAllocations', 'approve');
  const canDelete = can(session.role, 'timeOffAllocations', 'delete');

  const notices: string[] = [];
  if (allocation.status === 'DRAFT') {
    notices.push('This allocation is awaiting approval and does not yet contribute to the balance.');
  }
  if (remaining <= 0 && allocation.status === 'APPROVED') {
    notices.push('This allocation is fully consumed.');
  }

  return (
    <>
      <PageHeader
        title={`${allocation.type.name} Allocation`}
        subtitle={`${allocation.employee.firstName} ${allocation.employee.lastName} · ${allocation.quantity} ${unit}`}
        breadcrumb={[
          { label: 'Allocations', href: '/time-off/allocations' },
          { label: 'Allocation', href: `/time-off/allocations/${id}` },
        ]}
        actions={
          <AllocationActions
            id={id}
            status={allocation.status}
            canApprove={canApprove}
            canDelete={canDelete && approved.length === 0}
          />
        }
      />

      {notices.length > 0 && (
        <div className="mb-5">
          <AlertBanner
            tone={allocation.status === 'DRAFT' ? 'warning' : 'info'}
            title="Allocation status"
            items={notices}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AllocationForm
            action={saveAllocationAction}
            allocation={allocation}
            employees={[]}
            types={types}
            submitLabel="Save Allocation"
            cancelHref="/time-off/allocations"
            lockEmployee
            readOnly={!canUpdate}
          />

          {/* Requests that consumed this allocation */}
          <div className="card mt-5 p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Consuming Requests ({approved.length})
            </h3>
            {allocation.requests.length === 0 ? (
              <p className="text-sm text-slate-400">
                No requests have drawn from this allocation yet.
              </p>
            ) : (
              <div className="space-y-2">
                {allocation.requests.map((r) => (
                  <Link
                    key={r.id}
                    href={`/time-off/requests/${r.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDate(r.dateFrom)} — {formatDate(r.dateTo)}
                      </p>
                      <p className="text-xs text-slate-500">{r.reason ?? 'No reason given'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {r.duration}
                        {allocation.type.unit === 'DAY' ? 'd' : 'h'}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Employee</h3>
            <Link
              href={`/employees/${allocation.employeeId}`}
              className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-slate-50"
            >
              <Avatar
                firstName={allocation.employee.firstName}
                lastName={allocation.employee.lastName}
                size="lg"
                seed={allocation.employeeId}
              />
              <div>
                <p className="font-semibold text-slate-900">
                  {allocation.employee.firstName} {allocation.employee.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {allocation.employee.department?.name ?? '—'}
                </p>
              </div>
            </Link>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Balance</h3>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-600">Consumed</span>
              <span className="font-semibold text-slate-900">
                {taken} / {allocation.quantity}
              </span>
            </div>
            <ProgressBar
              value={taken}
              max={allocation.quantity || 1}
              colorHex={allocation.type.colorHex}
            />

            <dl className="mt-4 space-y-3.5 border-t border-slate-100 pt-4">
              <Field label="Status">
                <StatusBadge status={allocation.status} />
              </Field>
              <Field label="Allocated">
                {allocation.quantity} {unit}
              </Field>
              <Field label="Taken">
                {taken} {unit}
              </Field>
              <Field label="Remaining">
                <span className={remaining <= 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {remaining} {unit}
                </span>
              </Field>
              <Field label="Validity">
                {formatDate(allocation.validFrom)} —{' '}
                {allocation.validTo ? formatDate(allocation.validTo) : 'No expiry'}
              </Field>
              {allocation.approvedAt && (
                <Field label="Approved">
                  {allocation.approvedBy ?? '—'} on {formatDateTime(allocation.approvedAt)}
                </Field>
              )}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
