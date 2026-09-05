import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/ui';
import { StructureForm } from '../structure-form';

export const dynamic = 'force-dynamic';

export default async function NewStructurePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'salaryStructures', 'create')) redirect('/payroll/structures');

  return (
    <>
      <PageHeader
        title="New Salary Structure"
        subtitle="Create the container first, then add and sequence its salary rules."
        breadcrumb={[
          { label: 'Salary Structures', href: '/payroll/structures' },
          { label: 'New', href: '/payroll/structures/new' },
        ]}
      />

      <div className="max-w-lg">
        <StructureForm />
      </div>
    </>
  );
}
