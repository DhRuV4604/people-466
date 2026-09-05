import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  can,
  type LeaveRequestDto,
  type LeaveBalanceDto,
  type TimeOffTypeDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch, ApiError } from '@/lib/api-client';
import { formatDate, formatDateTime, splitName } from '@/lib/utils';
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

  const request = await apiFetch<LeaveRequestDto | null>(`/time-off/requests/${id}`, {
    nullOn404: true,
  }).catch((err) => {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/my-space');
    throw err;
  });

  if (!request) notFound();

  const [types, balances] = await Promise.all([
    apiGet<TimeOffTypeDto[]>('/time-off/types'),
    apiGet<LeaveBalanceDto[]>(`/time-off/balances/${request.employeeId}`),
  ]);

  const balance = balances.find((b) => b.typeId === request.typeId);
  const { first, last } = splitName(request.employee?.fullName ?? '');

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
  if (request.type.requiresAllocation && !request.allocationId && isPending) {
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
        subtitle={`${request.employee?.fullName} · ${formatDate(request.dateFrom)} — ${formatDate(request.dateTo)}`}
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
              session.role === 'EMPLOYEE' ? isPending : request.status !== 'CANCELLED'
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
            balances={balances}
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
              <Avatar firstName={first} lastName={last} size="lg" seed={request.employeeId} />
              <div>
                <p className="font-semibold text-slate-900">{request.employee?.fullName}</p>
                <p className="text-xs text-slate-500">{request.employee?.department ?? '—'}</p>
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
                {request.allocationId ? (
                  <Link
                    href={`/time-off/allocations/${request.allocationId}`}
                    className="text-brand-600 hover:underline"
                  >
                    View allocation
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
