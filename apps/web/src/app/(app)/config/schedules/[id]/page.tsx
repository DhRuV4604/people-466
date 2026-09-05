import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  can,
  type WorkingScheduleDto,
  type EmployeeSummaryDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch, ApiError } from '@/lib/api-client';
import { splitName } from '@/lib/utils';
import { PageHeader, Field, StatusBadge, Avatar } from '@/components/ui';
import { ScheduleForm } from '@/components/schedule-form';
import { DeleteScheduleButton } from './delete-button';

export const dynamic = 'force-dynamic';

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect('/login');

  const schedule = await apiFetch<WorkingScheduleDto | null>(`/working-schedules/${id}`, {
    nullOn404: true,
  }).catch((err) => {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect('/my-space');
    throw err;
  });

  if (!schedule) notFound();

  const allEmployees = await apiGet<EmployeeSummaryDto[]>('/employees');
  const assigned = allEmployees.filter((e) => e.workingSchedule?.id === id).slice(0, 12);

  const canUpdate = can(session.role, 'workingSchedules', 'update');
  const canDelete =
    can(session.role, 'workingSchedules', 'delete') &&
    (schedule.employeeCount ?? 0) === 0 &&
    (schedule.contractCount ?? 0) === 0;

  return (
    <>
      <PageHeader
        title={schedule.name}
        subtitle={`${schedule.hoursPerWeek} hours per week · ${schedule.scheduleType.replace('_', ' ')}`}
        breadcrumb={[
          { label: 'Working Schedules', href: '/config/schedules' },
          { label: schedule.name, href: `/config/schedules/${id}` },
        ]}
        actions={canDelete ? <DeleteScheduleButton id={id} /> : null}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ScheduleForm
            schedule={schedule}
            submitLabel="Save Schedule"
            cancelHref="/config/schedules"
            readOnly={!canUpdate}
          />
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Summary</h3>
            <dl className="space-y-3.5">
              <Field label="Weekly Hours">{schedule.hoursPerWeek}h</Field>
              <Field label="Working Days">
                {new Set(schedule.lines.map((l) => l.dayOfWeek)).size}
              </Field>
              <Field label="Assigned Employees">{schedule.employeeCount ?? 0}</Field>
              <Field label="Assigned Contracts">{schedule.contractCount ?? 0}</Field>
              <Field label="Status">
                <StatusBadge status={schedule.active ? 'ACTIVE' : 'INACTIVE'} />
              </Field>
            </dl>
          </div>

          {assigned.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned Employees</h3>
              <div className="space-y-2">
                {assigned.map((e) => {
                  const { first, last } = splitName(e.fullName);
                  return (
                    <Link
                      key={e.id}
                      href={`/employees/${e.id}`}
                      className="flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-slate-50"
                    >
                      <Avatar firstName={first} lastName={last} size="sm" seed={e.id} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-slate-900">
                          {e.fullName}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {e.department?.name ?? '—'}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
