import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
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
    prisma.employee.findMany({
      where: { status: { not: 'INACTIVE' } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.jobPosition.findMany({ orderBy: { name: 'asc' } }),
    prisma.workingSchedule.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.salaryStructure.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    params.employee
      ? prisma.employee.findUnique({ where: { id: params.employee } })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="New Contract"
        subtitle={
          employee
            ? `New contract for ${employee.firstName} ${employee.lastName}`
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
                name: `${employee.firstName} ${employee.lastName} — Contract`,
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
