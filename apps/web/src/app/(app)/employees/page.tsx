import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, type EmployeeSummaryDto, type DepartmentDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGet } from '@/lib/api-client';
import { formatDate, splitName } from '@/lib/utils';
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

  const params = await searchParams;
  const view = params.view === 'list' ? 'list' : 'kanban';

  const [employees, departments] = await Promise.all([
    apiGet<EmployeeSummaryDto[]>('/employees', {
      q: params.q,
      departmentId: params.department,
      employeeType: params.type,
      status: params.status,
      missingBank: params.missingBank ? 'true' : undefined,
    }),
    apiGet<DepartmentDto[]>('/departments'),
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
          {employees.map((e) => {
            const { first, last } = splitName(e.fullName);
            return (
              <Link
                key={e.id}
                href={`/employees/${e.id}`}
                className="card group p-4 transition hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <Avatar firstName={first} lastName={last} size="lg" seed={e.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 group-hover:text-brand-700">
                      {e.fullName}
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
                  <Row label="Manager" value={e.manager?.fullName ?? '—'} />
                  <Row label="Schedule" value={e.workingSchedule?.name ?? '—'} />
                </dl>

                {!e.hasBankDetails && (
                  <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                    Missing bank details
                  </p>
                )}
              </Link>
            );
          })}
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
              {employees.map((e) => {
                const { first, last } = splitName(e.fullName);
                return (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/employees/${e.id}`} className="flex items-center gap-2.5">
                        <Avatar firstName={first} lastName={last} size="sm" seed={e.id} />
                        <span>
                          <span className="block font-medium text-slate-900">{e.fullName}</span>
                          <span className="block text-xs text-slate-500">{e.workEmail}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{e.employeeCode}</td>
                    <td>{e.department?.name ?? '—'}</td>
                    <td>{e.jobPosition?.name ?? '—'}</td>
                    <td>{e.manager?.fullName ?? '—'}</td>
                    <td>
                      <Badge tone="slate">{e.employeeType.replace('_', ' ')}</Badge>
                    </td>
                    <td>{formatDate(e.hireDate)}</td>
                    <td>
                      <StatusBadge status={e.status} />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}
