import { redirect } from 'next/navigation';
import { can, type SalaryStructureDto, type DepartmentDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { startOfMonth, endOfMonth, toDateInput } from '@/lib/utils';
import { PageHeader, EmptyState } from '@/components/ui';
import { PayrunWizard } from './wizard';

export const dynamic = 'force-dynamic';

export default async function NewPayrunPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'payruns', 'create')) redirect('/payroll/payruns');

  const [structures, departments] = await Promise.all([
    apiGet<SalaryStructureDto[]>('/salary-structures'),
    apiGet<DepartmentDto[]>('/departments'),
  ]);

  const activeStructures = structures.filter((s) => s.active);

  if (activeStructures.length === 0) {
    return (
      <>
        <PageHeader
          title="New Pay Run"
          breadcrumb={[{ label: 'Pay Runs', href: '/payroll/payruns' }]}
        />
        <EmptyState
          title="No active salary structure"
          description="A pay run needs a salary structure to decide which rules compute its payslips."
        />
      </>
    );
  }

  // Default to the previous whole month, the usual payroll target.
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return (
    <>
      <PageHeader
        title="New Pay Run"
        subtitle="Define the scope and period, then choose exactly which employees to include."
        breadcrumb={[
          { label: 'Pay Runs', href: '/payroll/payruns' },
          { label: 'New', href: '/payroll/payruns/new' },
        ]}
      />

      <PayrunWizard
        structures={activeStructures}
        departments={departments}
        defaultPeriodStart={toDateInput(startOfMonth(lastMonth))}
        defaultPeriodEnd={toDateInput(endOfMonth(lastMonth))}
      />
    </>
  );
}
