import { redirect } from 'next/navigation';
import {
  can,
  type EmployeeSummaryDto,
  type EmployeeDetailDto,
  type JobPositionDto,
  type WorkingScheduleDto,
  type SalaryStructureDto,
} from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet, apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/ui';
import { ContractForm } from '@/components/contract-form';
import { createContractAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'contracts', 'create')) redirect('/contracts');

  const params = await searchParams;

  const [employees, positions, schedules, structures, employee] = await Promise.all([
    apiGet<EmployeeSummaryDto[]>('/employees'),
    apiGet<JobPositionDto[]>('/job-positions'),
    apiGet<WorkingScheduleDto[]>('/working-schedules'),
    apiGet<SalaryStructureDto[]>('/salary-structures'),
    params.employee
      ? apiFetch<EmployeeDetailDto | null>(`/employees/${params.employee}`, { nullOn404: true })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="New Contract"
        subtitle={
          employee
            ? `New contract for ${employee.fullName}`
            : 'Define the wage and terms payroll will use for a period.'
        }
        breadcrumb={[
          { label: 'Contracts', href: '/contracts' },
          { label: 'New', href: '/contracts/new' },
        ]}
      />

      <ContractForm
        action={createContractAction}
        contract={
          employee
            ? {
                employeeId: employee.id,
                name: `${employee.fullName} — Contract`,
                workingScheduleId: employee.workingScheduleId,
                jobPositionId: employee.jobPositionId,
              }
            : undefined
        }
        employees={employees}
        positions={positions}
        schedules={schedules}
        structures={structures}
        submitLabel="Create Contract"
        cancelHref={employee ? `/contracts?employee=${employee.id}` : '/contracts'}
      />
    </>
  );
}
