import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { PAYRUN_STATUSES, can, type PayrunDto } from "@peoplepay360/shared";

import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { EmptyState, StatGrid, StatTile } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { apiFetch } from "@/lib/api-client";
import { dateRange, money, moneyShort } from "@/lib/format";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import { NewPayrunLink } from "./_components/new-payrun-link";

export const metadata: Metadata = {
  title: "Pay runs",
  description: "Each period's run, from draft through to paid.",
};

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function PayrunsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("payruns");

  const params = await searchParams;
  const payruns = await apiFetch<PayrunDto[]>("/payruns", {
    query: { q: params.q, status: params.status },
  });

  const canCreate = can(session.role, "payruns", "create");
  const hasFilters = Boolean(params.q || params.status);
  const open = payruns.filter(
    (p) => p.status === "DRAFT" || p.status === "COMPUTED",
  ).length;
  const paidTotal = payruns
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.totalNet, 0);

  return (
    <>
      <StatGrid>
        <StatTile label="Runs" value={payruns.length} hint="All time" />
        <StatTile
          label="Still open"
          value={open}
          hint={open === 0 ? "Nothing in progress" : "Draft or computed"}
          tone={open > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label="Paid out"
          value={moneyShort(paidTotal)}
          hint="Across completed runs"
        />
        <StatTile
          label="Payslips"
          value={payruns.reduce((sum, p) => sum + p.payslipCount, 0)}
          hint="Issued by these runs"
        />
      </StatGrid>

      <FilterBar
        search={{ placeholder: "Search pay run" }}
        selects={[
          {
            key: "status",
            placeholder: "Any status",
            options: statusOptions(PAYRUN_STATUSES),
            width: "w-44",
          },
        ]}
        quickFilters={[
          { key: "status", value: "DRAFT", label: "Draft" },
          { key: "status", value: "PAID", label: "Paid" },
        ]}
        count={{ total: payruns.length, noun: "run" }}
        // A page rather than a dialog: who is eligible depends on the period
        // and the structure, so the roster can only be built once those have
        // been chosen.
        actions={canCreate ? <NewPayrunLink /> : null}
      />

      {payruns.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={hasFilters ? "No pay runs match" : "No pay runs yet"}
          description={
            hasFilters
              ? "Try a broader search, or clear a filter to widen the results."
              : "Start a run to pick a period and the people it pays; every payslip it produces lands here."
          }
        />
      ) : (
        <DataTable
          rows={payruns}
          getKey={(row) => row.id}
          href={(row) => `/payruns/${row.id}`}
          columns={[
            {
              header: "Run",
              className: "min-w-[200px]",
              cell: (row) => (
                <>
                  <span className="block truncate font-medium">{row.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.structure.name}
                  </span>
                </>
              ),
            },
            {
              header: "Period",
              hideBelow: "md",
              cell: (row) => (
                <span className="whitespace-nowrap text-muted-foreground">
                  {dateRange(row.periodStart, row.periodEnd)}
                </span>
              ),
            },
            {
              header: "Payslips",
              align: "right",
              hideBelow: "sm",
              cell: (row) => (
                <span className="tabular-nums">{row.payslipCount}</span>
              ),
            },
            {
              header: "Gross",
              align: "right",
              hideBelow: "lg",
              cell: (row) => (
                <span className="tabular-nums text-muted-foreground">
                  {money(row.totalGross)}
                </span>
              ),
            },
            {
              header: "Net",
              align: "right",
              cell: (row) => (
                <span className="tabular-nums font-medium">
                  {money(row.totalNet)}
                </span>
              ),
            },
            {
              header: "Status",
              align: "right",
              cell: (row) => <StatusBadge value={row.status} />,
            },
          ]}
        />
      )}
    </>
  );
}
