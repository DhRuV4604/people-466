import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
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
  if (!can(session.role, 'workingSchedules', 'read')) redirect('/dashboard');

  const schedule = await prisma.workingSchedule.findUnique({
    where: { id },
    include: {
      lines: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      employees: { include: { department: true }, take: 12 },
      _count: { select: { employees: true, contracts: true } },
    },
  });

  if (!schedule) notFound();

  const canUpdate = can(session.role, 'workingSchedules', 'update');
  const canDelete =
    can(session.role, 'workingSchedules', 'delete') &&
    schedule._count.employees === 0 &&
    schedule._count.contracts === 0;

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
              <Field label="Working Days">{new Set(schedule.lines.map((l) => l.dayOfWeek)).size}</Field>
              <Field label="Assigned Employees">{schedule._count.employees}</Field>
              <Field label="Assigned Contracts">{schedule._count.contracts}</Field>
              <Field label="Status">
                <StatusBadge status={schedule.active ? 'ACTIVE' : 'INACTIVE'} />
              </Field>
            </dl>
          </div>

          {schedule.employees.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Assigned Employees</h3>
              <div className="space-y-2">
                {schedule.employees.map((e) => (
                  <Link
                    key={e.id}
                    href={`/employees/${e.id}`}
                    className="flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-slate-50"
                  >
                    <Avatar firstName={e.firstName} lastName={e.lastName} size="sm" seed={e.id} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-slate-900">
                        {e.firstName} {e.lastName}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {e.department?.name ?? '—'}
                      </span>
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
