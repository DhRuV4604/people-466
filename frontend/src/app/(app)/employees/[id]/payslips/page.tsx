import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import {
  PAYSLIP_STATUSES,
  can,
  type Paginated,
  type PayslipDto,
} from "@peoplepay360/shared";

import { PdfLink } from "@/app/(app)/payslips/_components/pdf-link";
import { recomputePayslip } from "@/app/(app)/payslips/actions";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { EmptyState } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { RowActions } from "@/components/form";
import { Badge } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { dateRange, money } from "@/lib/format";
import { statusOptions } from "@/lib/status";

import { requireEmployeeTab } from "../_lib";

export const metadata: Metadata = { title: "Payslips" };

type SearchParams = Promise<{
  status?: string;
  page?: string;
  pageSize?: string;
}>;

/**
 * What this employee has been paid. A payslip is produced by a pay run and
 * never typed in, so there is nothing to create here — recompute is the one
 * write, and it rebuilds the lines from the salary rules and contract as they
 * stand now.
 */
export default async function EmployeePayslipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { session, employee } = await requireEmployeeTab(id, "payslips");
  const query = await searchParams;

  const status = PAYSLIP_STATUSES.some((value) => value === query.status)
    ? query.status
    : undefined;

  const slipPage = await apiFetch<Paginated<PayslipDto>>("/payslips", {
    query: { ...pageQuery(query), employeeId: employee.id, status },
  });

  const payslips = slipPage.items;
  const canRecompute = can(session.role, "payslips", "update");

  const columns: Column<PayslipDto>[] = [
    {
      header: "Payslip",
      className: "min-w-[160px]",
      cell: (row) => <span className="font-mono text-xs">{row.number}</span>,
    },
    {
      header: "Period",
      hideBelow: "sm",
      cell: (row) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {dateRange(row.periodStart, row.periodEnd)}
        </span>
      ),
    },
    {
      header: "Gross",
      align: "right",
      hideBelow: "md",
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {money(row.grossPay)}
        </span>
      ),
    },
    {
      header: "Deductions",
      align: "right",
      hideBelow: "lg",
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {money(row.totalDeductions)}
        </span>
      ),
    },
    {
      header: "Net",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums font-medium">{money(row.netPay)}</span>
      ),
    },
    {
      header: "Status",
      align: "right",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          {row.warnings.length > 0 ? (
            <Badge variant="destructive">
              {row.warnings.length}
              {/* Read on its own the number sounds like part of the status,
                  so say what it counts. */}
              <span className="sr-only">
                {row.warnings.length === 1 ? " warning" : " warnings"}
              </span>
            </Badge>
          ) : null}
          <StatusBadge value={row.status} />
        </span>
      ),
    },
    {
      className: "w-10",
      align: "right",
      cell: (row) => <PdfLink id={row.id} />,
    },
  ];

  if (canRecompute) {
    columns.push({
      className: "w-10",
      align: "right",
      cell: (row) => (
        <RowActions
          items={[
            {
              label: "Recompute",
              action: recomputePayslip.bind(null, row.id),
              confirm: {
                title: `Recompute ${row.number}?`,
                description:
                  "The stored lines are thrown away and built again from the salary rules and contract as they stand now, so the figures can change.",
                confirmLabel: "Recompute",
              },
            },
          ]}
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
            options: statusOptions(PAYSLIP_STATUSES),
            width: "w-44",
          },
        ]}
        quickFilters={[
          { key: "status", value: "PAID", label: "Paid" },
          { key: "status", value: "DRAFT", label: "Draft" },
        ]}
        count={{ total: slipPage.total, noun: "payslip" }}
      />

      {payslips.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={status ? "No payslips match" : "No payslips yet"}
          description={
            status
              ? "Clear the filter to see the rest of this employee's payslips."
              : `Payslips appear here once a pay run has computed one for ${employee.fullName}.`
          }
        />
      ) : (
        <>
          <DataTable
            rows={payslips}
            getKey={(row) => row.id}
            href={(row) => `/payslips/${row.id}`}
            columns={columns}
          />
          <Pagination meta={slipPage} noun="payslip" />
        </>
      )}
    </>
  );
}
