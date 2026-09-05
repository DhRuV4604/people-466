import { redirect } from 'next/navigation';
import {
  can,
  type DepartmentDto,
  type JobPositionDto,
  type WorkingScheduleDto,
  type EmployeeSummaryDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { PageHeader } from '@/components/ui';
import { EmployeeForm } from '@/components/employee-form';
import { createEmployeeAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewEmployeePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'employees', 'create')) redirect('/employees');

  const [departments, positions, managers, schedules] = await Promise.all([
    apiGet<DepartmentDto[]>('/departments'),
    apiGet<JobPositionDto[]>('/job-positions'),
    apiGet<EmployeeSummaryDto[]>('/employees', { status: 'ACTIVE' }),
    apiGet<WorkingScheduleDto[]>('/working-schedules'),
  ]);

  return (
    <>
      <PageHeader
        title="New Employee"
        subtitle="Create an employee record; contracts and schedules can be attached afterwards."
        breadcrumb={[
          { label: 'Employees', href: '/employees' },
          { label: 'New', href: '/employees/new' },
        ]}
      />

      <EmployeeForm
        action={createEmployeeAction}
        departments={departments}
        positions={positions}
        managers={managers}
        schedules={schedules}
        submitLabel="Create Employee"
        cancelHref="/employees"
      />
    </>
  );
}
