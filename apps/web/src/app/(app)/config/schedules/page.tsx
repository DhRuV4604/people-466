import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, DAY_SHORT, type WorkingScheduleDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { PageHeader, EmptyState, Badge, StatusBadge, Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SchedulesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const schedules = await apiGet<WorkingScheduleDto[]>('/working-schedules');
  const canCreate = can(session.role, 'workingSchedules', 'create');

  return (
    <>
      <PageHeader
        title="Working Schedules"
        subtitle="Weekly hour patterns. Total weekly hours are calculated from the defined days, never entered by hand."
        actions={
          canCreate ? (
            <Link href="/config/schedules/new" className="btn-primary">
              New Schedule
            </Link>
          ) : null
        }
      />

      <Tabs
        active="/config/schedules"
        tabs={[
          { label: 'Working Schedules', href: '/config/schedules' },
          { label: 'Departments', href: '/config/departments' },
          { label: 'Job Positions', href: '/config/positions' },
          ...(can(session.role, 'users', 'read')
            ? [{ label: 'Users & Roles', href: '/config/users' }]
            : []),
        ]}
      />

      {schedules.length === 0 ? (
        <EmptyState
          title="No working schedules"
          description="Schedules standardise attendance expectations and payroll working days."
          action={
            canCreate ? (
              <Link href="/config/schedules/new" className="btn-primary">
                New Schedule
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Type</th>
                <th>Weekly Hours</th>
                <th>Working Days</th>
                <th>Assigned</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => {
                const days = [...new Set(s.lines.map((l) => l.dayOfWeek))].sort();
                return (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/config/schedules/${s.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td>
                      <Badge tone="slate">{s.scheduleType.replace('_', ' ')}</Badge>
                    </td>
                    <td className="font-semibold text-slate-900">{s.hoursPerWeek}h</td>
                    <td>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                          <span
                            key={d}
                            className={`flex h-6 w-8 items-center justify-center rounded text-[10px] font-medium ${
                              days.includes(d)
                                ? 'bg-brand-100 text-brand-700'
                                : 'bg-slate-100 text-slate-300'
                            }`}
                          >
                            {DAY_SHORT[d].slice(0, 2)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-xs">
                      {s.employeeCount ?? 0} employee(s) · {s.contractCount ?? 0} contract(s)
                    </td>
                    <td>
                      <StatusBadge status={s.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td>
                      <Link
                        href={`/config/schedules/${s.id}`}
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
    </>
  );
}
