import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatDateTime } from '@/lib/utils';
import { getLeaveBalances } from '@/lib/timeoff';
import {
  PageHeader,
  StatusBadge,
  Avatar,
  Field,
  ProgressBar,
  AlertBanner,
} from '@/components/ui';
import { LeaveRequestForm } from '@/components/leave-request-form';
import { saveLeaveRequestAction } from '../../actions';
import { ApprovalActions } from './approval-actions';

export const dynamic = 'force-dynamic';

export default async function LeaveRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffRequests', 'read')) redirect('/my-space');

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true } },
      type: true,
      allocation: true,
    },
  });

  if (!request) notFound();
  if (session.role === 'EMPLOYEE' && session.employeeId !== request.employeeId) {
    redirect('/my-space');
  }

  const [types, balances] = await Promise.all([
    prisma.timeOffType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    getLeaveBalances(request.employeeId),
  ]);

  const balance = balances.find((b) => b.typeId === request.typeId);

  const canApprove = can(session.role, 'timeOffRequests', 'approve');
  const canUpdate = can(session.role, 'timeOffRequests', 'update');
  const canDelete = can(session.role, 'timeOffRequests', 'delete');
  const isPending = request.status === 'TO_APPROVE';
  // An approved request is locked for employees but still correctable by HR.
  const editable = canUpdate && (isPending || session.role !== 'EMPLOYEE');

  const notices: string[] = [];
  if (request.status === 'APPROVED' && request.allocationId) {
    notices.push(
      `Approved by ${request.approvedBy ?? 'HR'}${
        request.approvedAt ? ` on ${formatDateTime(request.approvedAt)}` : ''
      }. ${request.duration} ${request.type.unit === 'DAY' ? 'day(s)' : 'hour(s)'} were consumed from the linked allocation.`
    );
  }
  if (request.status === 'REFUSED') {
    notices.push(
      `Refused by ${request.refusedBy ?? 'HR'}${
        request.refusedAt ? ` on ${formatDateTime(request.refusedAt)}` : ''
      }. ${request.refuseReason ?? ''}`
    );
  }
  if (request.type.requiresAllocation && !request.allocationId && request.status === 'TO_APPROVE') {
    if (!balance || balance.remaining < request.duration) {
      notices.push(
        `Insufficient balance: ${balance?.remaining ?? 0} remaining against ${request.duration} requested. Approval will be blocked.`
      );
    }
  }

  return (
    <>
      <PageHeader
        title={`${request.type.name} Request`}
        subtitle={`${request.employee.firstName} ${request.employee.lastName} · ${formatDate(request.dateFrom)} — ${formatDate(request.dateTo)}`}
        breadcrumb={[
          { label: 'Time Off', href: '/time-off/requests' },
          { label: 'Request', href: `/time-off/requests/${id}` },
        ]}
        actions={
          <ApprovalActions
            id={id}
            status={request.status}
            canApprove={canApprove}
            canDelete={canDelete}
            canCancel={
              session.role === 'EMPLOYEE'
                ? request.status === 'TO_APPROVE'
                : request.status !== 'CANCELLED'
            }
          />
        }
      />

      {notices.length > 0 && (
        <div className="mb-5">
          <AlertBanner
            tone={request.status === 'REFUSED' ? 'danger' : isPending ? 'warning' : 'success'}
            title="Request status"
            items={notices}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeaveRequestForm
            action={saveLeaveRequestAction}
            request={request}
            employees={[]}
            types={types}
            balances={balances.map((b) => ({
              typeId: b.typeId,
              remaining: b.remaining,
              allocated: b.allocated,
              unit: b.unit,
            }))}
            submitLabel="Save Request"
            cancelHref="/time-off/requests"
            lockEmployee
            readOnly={!editable}
          />
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Employee</h3>
            <Link
              href={`/employees/${request.employeeId}`}
              className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-slate-50"
            >
              <Avatar
                firstName={request.employee.firstName}
                lastName={request.employee.lastName}
                size="lg"
                seed={request.employeeId}
              />
              <div>
                <p className="font-semibold text-slate-900">
                  {request.employee.firstName} {request.employee.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {request.employee.department?.name ?? '—'}
                </p>
              </div>
            </Link>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Request Summary</h3>
            <dl className="space-y-3.5">
              <Field label="Status">
                <StatusBadge status={request.status} />
              </Field>
              <Field label="Type">{request.type.name}</Field>
              <Field label="Duration">
                {request.duration} {request.type.unit === 'DAY' ? 'day(s)' : 'hour(s)'}
              </Field>
              <Field label="Paid">{request.type.paid ? 'Yes' : 'No — reduces net pay'}</Field>
              <Field label="Linked Allocation">
                {request.allocation ? (
                  <Link
                    href={`/time-off/allocations/${request.allocationId}`}
                    className="text-brand-600 hover:underline"
                  >
                    {request.allocation.quantity} {request.type.unit === 'DAY' ? 'days' : 'hours'} allocation
                  </Link>
                ) : request.type.requiresAllocation ? (
                  <span className="text-amber-600">Not yet consumed</span>
                ) : (
                  'Not required'
                )}
              </Field>
              <Field label="Submitted">{formatDateTime(request.createdAt)}</Field>
            </dl>
          </div>

          {balance && request.type.requiresAllocation && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                {request.type.name} Balance
              </h3>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-600">Consumed</span>
                <span className="font-semibold text-slate-900">
                  {balance.taken} / {balance.allocated}
                </span>
              </div>
              <ProgressBar
                value={balance.taken}
                max={balance.allocated || 1}
                colorHex={balance.colorHex}
              />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Allocated" value={balance.allocated} />
                <Stat label="Taken" value={balance.taken} />
                <Stat label="Remaining" value={balance.remaining} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className="text-sm font-bold text-slate-900">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
