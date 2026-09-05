import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';
import { PageHeader, StatusBadge, Avatar, EmptyState, Badge } from '@/components/ui';
import { EmployeeFilters } from './filters';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    view?: string;
    q?: string;
    department?: string;
    type?: string;
    status?: string;
    missingBank?: string;
  }>;
}

export default async function EmployeesPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, 'employees', 'read')) redirect('/my-space');

  const params = await searchParams;
  const view = params.view === 'list' ? 'list' : 'kanban';

  // Employees only ever see their own record.
  const ownScope = session.role === 'EMPLOYEE' ? { id: session.employeeId ?? '__none__' } : {};

  const where = {
    ...ownScope,
    ...(params.q
      ? {
          OR: [
            { firstName: { contains: params.q } },
            { lastName: { contains: params.q } },
            { workEmail: { contains: params.q } },
            { employeeCode: { contains: params.q } },
          ],
        }
      : {}),
    ...(params.department ? { departmentId: params.department } : {}),
    ...(params.type ? { employeeType: params.type } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.missingBank ? { OR: [{ bankAccountNumber: null }, { bankName: null }] } : {}),
  };

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        department: true,
        jobPosition: true,
        manager: { select: { firstName: true, lastName: true } },
        workingSchedule: { select: { name: true } },
        _count: { select: { contracts: true, attendances: true, leaveRequests: true } },
      },
      orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const canCreate = can(session.role, 'employees', 'create');

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} employee${employees.length === 1 ? '' : 's'}${
          params.missingBank ? ' · missing bank details' : ''
        }`}
        actions={
          canCreate ? (
            <Link href="/employees/new" className="btn-primary">
              New Employee
            </Link>
          ) : null
        }
      />

      <EmployeeFilters
        departments={departments}
        view={view}
        q={params.q ?? ''}
        department={params.department ?? ''}
        type={params.type ?? ''}
        status={params.status ?? ''}
      />

      {employees.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No employees found"
            description="Adjust the filters, or create the first employee record."
            action={
              canCreate ? (
                <Link href="/employees/new" className="btn-primary">
                  New Employee
                </Link>
              ) : null
            }
          />
        </div>
      ) : view === 'kanban' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((e) => (
            <Link
              key={e.id}
              href={`/employees/${e.id}`}
              className="card group p-4 transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <Avatar firstName={e.firstName} lastName={e.lastName} size="lg" seed={e.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 group-hover:text-brand-700">
                    {e.firstName} {e.lastName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {e.jobPosition?.name ?? 'No position'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">{e.employeeCode}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={e.status} />
                <Badge tone="slate">{e.employeeType.replace('_', ' ')}</Badge>
              </div>

              <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs">
                <Row label="Department" value={e.department?.name ?? '—'} />
                <Row
                  label="Manager"
                  value={e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '—'}
                />
                <Row label="Schedule" value={e.workingSchedule?.name ?? '—'} />
              </dl>

              {(!e.bankAccountNumber || !e.bankName) && (
                <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                  Missing bank details
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Department</th>
                <th>Position</th>
                <th>Manager</th>
                <th>Type</th>
                <th>Hire Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="cursor-pointer">
                  <td>
                    <Link href={`/employees/${e.id}`} className="flex items-center gap-2.5">
                      <Avatar firstName={e.firstName} lastName={e.lastName} size="sm" seed={e.id} />
                      <span>
                        <span className="block font-medium text-slate-900">
                          {e.firstName} {e.lastName}
                        </span>
                        <span className="block text-xs text-slate-500">{e.workEmail}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="font-mono text-xs">{e.employeeCode}</td>
                  <td>{e.department?.name ?? '—'}</td>
                  <td>{e.jobPosition?.name ?? '—'}</td>
                  <td>{e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '—'}</td>
                  <td>
                    <Badge tone="slate">{e.employeeType.replace('_', ' ')}</Badge>
                  </td>
                  <td>{formatDate(e.hireDate)}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}
