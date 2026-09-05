import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PAYSLIP_STATUSES, type PayslipDto, type Paginated } from "@peoplepay360/shared";

import { DataTable } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import {
  EmptyState,
  PersonCell,
  StatGrid,
  StatTile,
} from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { dateRange, money, moneyShort } from "@/lib/format";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";
import { ALL_ROWS } from "@/lib/paged";

import { PdfLink } from "./_components/pdf-link";

export const metadata: Metadata = {
  title: "Payslips",
  description: "Every payslip issued, and what it paid.",
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAccess("payslips");

  const params = await searchParams;
  // Two reads: the page the table shows, and the whole filtered set the
  // figures above it describe. The totals are about every payslip matching the
  // filter, not the twenty in view, and a summary endpoint would be the
  // cheaper way to say that once these tables are genuinely large.
  const [slipPage, all] = await Promise.all([
    apiFetch<Paginated<PayslipDto>>("/payslips", {
      query: { ...pageQuery(params), q: params.q, status: params.status },
    }),
    apiFetch<Paginated<PayslipDto>>("/payslips", {
      query: { q: params.q, status: params.status, pageSize: ALL_ROWS },
    }),
  ]);

  const payslips = slipPage.items;
  const everySlip = all.items;

  const withWarnings = everySlip.filter((p) => p.warnings.length > 0).length;
  const totalNet = everySlip.reduce((sum, p) => sum + p.netPay, 0);
  const hasFilters = Boolean(params.q || params.status);

  return (
    <>
      <StatGrid>
        <StatTile label="Payslips" value={slipPage.total} hint="Matching the filter" />
        <StatTile label="Net total" value={moneyShort(totalNet)} hint="Across the list" />
        <StatTile
          label="Gross total"
          value={moneyShort(everySlip.reduce((s, p) => s + p.grossPay, 0))}
          hint="Before deductions"
        />
        <StatTile
          label="With warnings"
          value={withWarnings}
          hint={withWarnings === 0 ? "All clean" : "Check before paying"}
          tone={withWarnings > 0 ? "danger" : "neutral"}
        />
      </StatGrid>

      <FilterBar
        search={{ placeholder: "Search employee or number" }}
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
          title={
            hasFilters ? "No payslips match those filters" : "No payslips yet"
          }
          description={
            hasFilters
              ? "Try a broader search, or clear a filter to widen the results."
              : "Payslips appear here once a pay run has computed them."
          }
        />
      ) : (
        <DataTable
          rows={payslips}
          getKey={(row) => row.id}
          href={(row) => `/payslips/${row.id}`}
          columns={[
            {
              header: "Employee",
              className: "min-w-[200px]",
              cell: (row) => (
                <PersonCell
                  name={row.employee?.fullName ?? "Unknown"}
                  meta={row.number}
                />
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
              header: "Gross",
              align: "right",
              hideBelow: "sm",
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
                <span className="tabular-nums font-medium">
                  {money(row.netPay)}
                </span>
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
                      {/* Read on its own the number sounds like part of the
                          status, so say what it counts. */}
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
              // One action, so a menu would be a click in the way of it.
              className: "w-10",
              align: "right",
              cell: (row) => <PdfLink id={row.id} />,
            },
          ]}
        />
      )}

      <Pagination meta={slipPage} noun="payslip" />
    </>
  );
}
