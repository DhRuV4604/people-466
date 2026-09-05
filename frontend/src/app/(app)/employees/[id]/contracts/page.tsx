import type { Metadata } from "next";
import { FileText } from "lucide-react";
import {
  CONTRACT_STATUSES,
  can,
  type ContractDto,
  type Paginated,
} from "@peoplepay360/shared";

import { deleteContract, saveContract } from "@/app/(app)/contracts/actions";
import { contractFields } from "@/app/(app)/contracts/fields";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { EmptyState } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { RecordDialog, RowActions } from "@/components/form";
import { apiFetch } from "@/lib/api-client";
import { withoutField } from "@/lib/fields";
import { dateRange, money } from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { statusOptions } from "@/lib/status";

import { saveContractFor } from "../actions";
import { requireEmployeeTab } from "../_lib";

export const metadata: Metadata = { title: "Contracts" };

type SearchParams = Promise<{
  status?: string;
  page?: string;
  pageSize?: string;
}>;

/**
 * What this employee has been engaged on, and for how long. The wage here is
 * what payroll computes their payslip from, so the tab sits next to the
 * payslips it explains.
 */
export default async function EmployeeContractsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { session, employee } = await requireEmployeeTab(id, "contracts");
  const query = await searchParams;

  const status = CONTRACT_STATUSES.some((value) => value === query.status)
    ? query.status
    : undefined;

  const canCreate = can(session.role, "contracts", "create");
  const canUpdate = can(session.role, "contracts", "update");
  const canDelete = can(session.role, "contracts", "delete");

  const [contractPage, refs] = await Promise.all([
    apiFetch<Paginated<ContractDto>>("/contracts", {
      query: { ...pageQuery(query), employeeId: employee.id, status },
    }),
    // The forms point a contract at a position, schedule and structure. The
    // employee list is not among them: the route already fixes that.
    canCreate || canUpdate
      ? loadRefs(["positions", "schedules", "structures"])
      : null,
  ]);

  const contracts = contractPage.items;

  // The employee comes off both forms. On a create it is bound into the
  // action; on an edit the API ignores it anyway, since a contract cannot be
  // moved to somebody else.
  const formFields = refs
    ? withoutField(contractFields(refs), "employeeId")
    : [];

  const columns: Column<ContractDto>[] = [
    {
      header: "Contract",
      className: "min-w-[200px]",
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      header: "Type",
      hideBelow: "md",
      cell: (row) => <StatusBadge value={row.contractType} />,
    },
    {
      header: "Period",
      hideBelow: "sm",
      cell: (row) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {dateRange(row.dateStart, row.dateEnd)}
        </span>
      ),
    },
    {
      header: "Wage",
      align: "right",
      cell: (row) => <span className="tabular-nums">{money(row.wage)}</span>,
    },
    {
      header: "Status",
      align: "right",
      cell: (row) => <StatusBadge value={row.status} />,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      className: "w-10",
      align: "right",
      cell: (row) => (
        <RowActions
          edit={
            canUpdate
              ? {
                  title: "Edit contract",
                  description:
                    "Changes apply to payslips computed from here on, not to ones already generated.",
                  fields: formFields,
                  action: saveContract,
                  record: { ...row },
                }
              : undefined
          }
          remove={
            canDelete
              ? {
                  action: deleteContract.bind(null, row.id),
                  title: `Delete ${row.name}?`,
                  description:
                    "This removes the contract and everything it carries: wage, dates, schedule and salary structure. A contract that payslips already reference is cancelled instead of deleted.",
                }
              : undefined
          }
        />
      ),
    });
  }

  return (
    <>
      <FilterBar
        selects={[
          {
            key: "status",
            placeholder: "Any status",
            options: statusOptions(CONTRACT_STATUSES),
          },
        ]}
        count={{ total: contractPage.total, noun: "contract" }}
        actions={
          canCreate ? (
            <RecordDialog
              title="New contract"
              description={`Written for ${employee.fullName}. A running contract cannot overlap another running one for the same employee, so leave it as a draft to set it up ahead of time.`}
              fields={formFields}
              action={saveContractFor.bind(null, employee.id)}
              submitLabel="Create contract"
            />
          ) : null
        }
      />

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={status ? "No contracts match" : "No contracts yet"}
          description={
            status
              ? "Clear the filter to see the rest of this employee's contracts."
              : `A contract sets the wage, dates and schedule payroll computes ${employee.fullName}'s payslip from.`
          }
        />
      ) : (
        <>
          <DataTable rows={contracts} getKey={(row) => row.id} columns={columns} />
          <Pagination meta={contractPage} noun="contract" />
        </>
      )}
    </>
  );
}
