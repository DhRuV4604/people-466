import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { can } from '@peoplepay360/shared';
import { PageHeader } from '@/components/ui';
import { ScheduleForm } from '@/components/schedule-form';

export const dynamic = 'force-dynamic';

export default async function NewSchedulePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'workingSchedules', 'create')) redirect('/config/schedules');

  return (
    <>
      <PageHeader
        title="New Working Schedule"
        subtitle="Define the weekly pattern; total hours are derived from the days you add."
        breadcrumb={[
          { label: 'Working Schedules', href: '/config/schedules' },
          { label: 'New', href: '/config/schedules/new' },
        ]}
      />

      <ScheduleForm submitLabel="Create Schedule" cancelHref="/config/schedules" />
    </>
  );
}
