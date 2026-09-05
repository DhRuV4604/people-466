import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { AllocationForm } from '@/components/allocation-form';
import { saveAllocationAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function NewAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'timeOffAllocations', 'create')) redirect('/time-off/allocations');

  const params = await searchParams;

  const [employees, types] = await Promise.all([
    prisma.employee.findMany({
      where: { status: { not: 'INACTIVE' } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.timeOffType.findMany({
      where: { active: true, requiresAllocation: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const now = new Date();

  return (
    <>
      <PageHeader
        title="New Leave Allocation"
        subtitle="Grant a leave balance an employee can draw from; requests consume it once approved."
        breadcrumb={[
          { label: 'Allocations', href: '/time-off/allocations' },
          { label: 'New', href: '/time-off/allocations/new' },
        ]}
      />

      <AllocationForm
        action={saveAllocationAction}
        allocation={{
          employeeId: params.employee,
          validFrom: new Date(now.getFullYear(), 0, 1),
          validTo: new Date(now.getFullYear(), 11, 31),
        }}
        employees={employees}
        types={types}
        submitLabel="Create Allocation"
        cancelHref="/time-off/allocations"
        lockEmployee={Boolean(params.employee)}
      />
    </>
  );
}
