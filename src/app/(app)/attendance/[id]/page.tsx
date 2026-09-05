import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate, formatDateTime, formatHours } from '@/lib/utils';
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
  if (!can(session.role, 'attendance', 'read')) redirect('/my-space');

  const record = await prisma.attendance.findUnique({
    where: { id },
    include: {
      employee: {
        include: { department: true, workingSchedule: true },
      },
    },
  });

  if (!record) notFound();
  if (session.role === 'EMPLOYEE' && session.employeeId !== record.employeeId) {
    redirect('/my-space');
  }

  const editor = record.editedById
    ? await prisma.user.findUnique({ where: { id: record.editedById }, select: { name: true } })
    : null;

  const canUpdate = can(session.role, 'attendance', 'update');
  const canDelete = can(session.role, 'attendance', 'delete');

  const notices: string[] = [];
  if (!record.checkOut) notices.push('This entry has no check-out recorded.');
  if (record.manuallyEdited) {
    notices.push(
      `Manually corrected${editor ? ` by ${editor.name}` : ''}${
        record.editedAt ? ` on ${formatDateTime(record.editedAt)}` : ''
      }${record.editReason ? ` — ${record.editReason}` : ''}.`
    );
  }

  return (
    <>
      <PageHeader
        title={`Attendance — ${formatDate(record.checkIn)}`}
        subtitle={`${record.employee.firstName} ${record.employee.lastName}`}
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
              <Avatar
                firstName={record.employee.firstName}
                lastName={record.employee.lastName}
                size="lg"
                seed={record.employeeId}
              />
              <div>
                <p className="font-semibold text-slate-900">
                  {record.employee.firstName} {record.employee.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {record.employee.department?.name ?? '—'}
                </p>
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
              <Field label="Schedule">{record.employee.workingSchedule?.name ?? '—'}</Field>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
