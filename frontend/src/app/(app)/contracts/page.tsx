import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { CONTRACT_STATUSES, can, type ContractDto } from "@peoplepay360/shared";

import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { EmptyState, PersonCell } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { RecordDialog, RowActions } from "@/components/form";
import { apiFetch } from "@/lib/api-client";
import { dateRange, money } from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import { deleteContract, saveContract } from "./actions";
import { contractFields } from "./fields";

export const metadata: Metadata = {
  title: "Contracts",
  description: "What each employee is engaged on, and for how long.",
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  expiring?: string;
}>;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("contracts");

  const params = await searchParams;
  const expiring = params.expiring === "true";

  const [contracts, refs] = await Promise.all([
    apiFetch<ContractDto[]>("/contracts", {
      query: {
        q: params.q,
        status: params.status,
        expiring: expiring ? "true" : undefined,
      },
    }),
    loadRefs(["employees", "positions", "schedules", "structures"]),
  ]);

  const canCreate = can(session.role, "contracts", "create");
  const canUpdate = can(session.role, "contracts", "update");
  const canDelete = can(session.role, "contracts", "delete");
  const hasFilters = Boolean(params.q || params.status || expiring);

  const columns: Column<ContractDto>[] = [
    {
      header: "Employee",
      className: "min-w-[200px]",
      cell: (row) => (
        <PersonCell
          name={row.employee?.fullName ?? "Unknown"}
          meta={row.name}
          href={row.employeeId ? `/employees/${row.employeeId}` : undefined}
        />
      ),
    },
    {
      header: "Department",
      hideBelow: "lg",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.employee?.department ?? "—"}
        </span>
      ),
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

  // The list returns the whole contract, so editing from the row cannot blank a
  // column the table does not show.
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
                    "Changes apply to payslips computed from here on, not to ones already generated. The employee stays as it is; a contract cannot be moved.",
                  fields: contractFields(refs),
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
        search={{ placeholder: "Search contract or employee" }}
        selects={[
          {
            key: "status",
            placeholder: "Any status",
            options: statusOptions(CONTRACT_STATUSES),
          },
        ]}
        quickFilters={[
          { key: "expiring", value: "true", label: "Expiring soon" },
        ]}
        count={{ total: contracts.length, noun: "contract" }}
        actions={
          canCreate ? (
            <RecordDialog
              title="New contract"
              description="A running contract cannot overlap another running one for the same employee. Leave it as a draft to set it up ahead of time."
              fields={contractFields(refs)}
              action={saveContract}
              submitLabel="Create contract"
            />
          ) : null
        }
      />

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasFilters ? "No contracts match" : "No contracts yet"}
          description={
            hasFilters
              ? "Try a broader search, or clear a filter to widen the results."
              : "A contract sets the wage, dates and schedule payroll computes a payslip from."
          }
        />
      ) : (
        <DataTable
          rows={contracts}
          getKey={(row) => row.id}
          columns={columns}
        />
      )}
    </>
  );
}
