import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { can, type AttendanceDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiFetch, ApiError } from '@/lib/api-client';
import { formatDate, formatDateTime, formatHours, splitName } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, Field, Badge, AlertBanner } from '@/components/ui';
import { AttendanceForm } from '@/components/attendance-form';
import { updateAttendanceAction } from '../actions';
import { DeleteAttendanceButton } from './delete-button';

export const dynamic = 'force-dynamic';

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');

  const record = await apiFetch<AttendanceDto | null>(`/attendance/${id}`, {
    nullOn404: true,
  }).catch((err) => {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/my-space');
    throw err;
  });

  if (!record) notFound();

  const { first, last } = splitName(record.employee?.fullName ?? '');
  const canUpdate = can(session.role, 'attendance', 'update');
  const canDelete = can(session.role, 'attendance', 'delete');

  const notices: string[] = [];
  if (!record.checkOut) notices.push('This entry has no check-out recorded.');
  if (record.manuallyEdited) {
    notices.push(
      `Manually corrected${record.editedByName ? ` by ${record.editedByName}` : ''}${
        record.editedAt ? ` on ${formatDateTime(record.editedAt)}` : ''
      }${record.editReason ? ` — ${record.editReason}` : ''}.`
    );
  }

  return (
    <>
      <PageHeader
        title={`Attendance — ${formatDate(record.checkIn)}`}
        subtitle={record.employee?.fullName}
        breadcrumb={[
          { label: 'Attendance', href: '/attendance' },
          { label: formatDate(record.checkIn), href: `/attendance/${id}` },
        ]}
        actions={canDelete ? <DeleteAttendanceButton id={id} /> : null}
      />

      {notices.length > 0 && (
        <div className="mb-5">
          <AlertBanner tone="info" title="Record notes" items={notices} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttendanceForm
            action={updateAttendanceAction}
            record={record}
            employees={[]}
            submitLabel="Save Corrections"
            cancelHref="/attendance"
            isEdit
            lockEmployee
            readOnly={!canUpdate}
          />
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Employee</h3>
            <Link
              href={`/employees/${record.employeeId}`}
              className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-slate-50"
            >
              <Avatar firstName={first} lastName={last} size="lg" seed={record.employeeId} />
              <div>
                <p className="font-semibold text-slate-900">{record.employee?.fullName}</p>
                <p className="text-xs text-slate-500">{record.employee?.department ?? '—'}</p>
              </div>
            </Link>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Computed Values</h3>
            <dl className="space-y-3.5">
              <Field label="Status">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={record.status} />
                  {record.manuallyEdited && <Badge tone="violet">Edited</Badge>}
                </div>
              </Field>
              <Field label="Check In">{formatDateTime(record.checkIn)}</Field>
              <Field label="Check Out">
                {record.checkOut ? formatDateTime(record.checkOut) : '— open shift'}
              </Field>
              <Field label="Worked Hours">{formatHours(record.workedHours)}</Field>
              <Field label="Overtime">{formatHours(record.overtimeHours)}</Field>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
