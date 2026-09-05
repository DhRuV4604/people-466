import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  CheckCheck,
  Send,
  Trash2,
} from "lucide-react";
import { can, type PayrunDto, type PayrunStatus } from "@peoplepay360/shared";

import { DataTable } from "@/components/data/data-table";
import {
  Fact,
  FactGrid,
  PersonCell,
  Section,
  StatGrid,
  StatTile,
} from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { ActionButton } from "@/components/form";
import { BackLink, Badge, PageHeader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import {
  dateRange,
  formatDate,
  money,
  moneyShort,
  pluralise,
} from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { statusLabel } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import {
  computePayrun,
  deletePayrunAndReturn,
  markPayrunPaid,
  sendPayslips,
  validatePayrun,
} from "../actions";

type PageProps = { params: Promise<{ id: string }> };

async function getPayrun(id: string): Promise<PayrunDto | null> {
  try {
    return await apiFetch<PayrunDto>(`/payruns/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const payrun = await getPayrun(id);
  return { title: payrun?.name ?? "Pay run" };
}

/** Where the run is, and what still has to happen to it. */
const STAGE: Record<PayrunStatus, string> = {
  DRAFT: "Nothing has been computed yet.",
  COMPUTED: "Figures exist but have not been validated.",
  VALIDATED: "Approved and ready to be paid.",
  PAID: "Paid. This run can no longer change.",
  CANCELLED: "Cancelled. Kept for the record.",
};

export default async function PayrunPage({ params }: PageProps) {
  const session = await requireAccess("payruns");

  const { id } = await params;
  const payrun = await getPayrun(id);
  if (!payrun) notFound();

  // The API gates the whole lifecycle on payruns:update, so a role that can
  // only read a run is offered no verbs at all.
  const canUpdate = can(session.role, "payruns", "update");
  const canDelete = can(session.role, "payruns", "delete");

  const payslips = payrun.payslips ?? [];
  const warnings = payrun.warnings ?? [];

  // The run stores what it was scoped to as raw values, so the department is a
  // record id and the type is an enum constant. Only a run that was scoped
  // pays for the lookup.
  const departments = payrun.departmentFilter
    ? (await loadRefs(["departments"])).departments
    : [];
  const departmentFilter = payrun.departmentFilter
    ? (departments.find((option) => option.value === payrun.departmentFilter)
        ?.label ?? payrun.departmentFilter)
    : "All departments";

  return (
    <>
      <PageHeader
        above={<BackLink href="/payruns">All pay runs</BackLink>}
        title={payrun.name}
        description={STAGE[payrun.status]}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <StatusBadge value={payrun.status} />

            {canUpdate && payrun.status === "DRAFT" ? (
              <ActionButton
                startIcon={<Calculator />}
                action={computePayrun.bind(null, payrun.id)}
                pendingLabel="Computing"
              >
                Compute
              </ActionButton>
            ) : null}

            {canUpdate && payrun.status === "COMPUTED" ? (
              <ActionButton
                startIcon={<CheckCheck />}
                action={validatePayrun.bind(null, payrun.id)}
                pendingLabel="Validating"
                confirm={{
                  title: "Validate this pay run?",
                  description: `This approves the figures and marks the ${pluralise(
                    payrun.payslipCount,
                    "payslip",
                  )} in it as validated. Anything blocking, such as missing bank details or a duplicate payslip, has to be cleared first.`,
                  confirmLabel: "Validate",
                }}
              >
                Validate
              </ActionButton>
            ) : null}

            {canUpdate && payrun.status === "VALIDATED" ? (
              <ActionButton
                startIcon={<Banknote />}
                action={markPayrunPaid.bind(null, payrun.id)}
                pendingLabel="Marking paid"
                confirm={{
                  title: "Mark this pay run as paid?",
                  description: `This records ${money(
                    payrun.totalNet,
                  )} as paid across ${pluralise(
                    payrun.payslipCount,
                    "payslip",
                  )} and closes the run: a paid run cannot be recomputed or deleted.`,
                  confirmLabel: "Mark paid",
                }}
              >
                Mark paid
              </ActionButton>
            ) : null}

            {/* The API allows this from COMPUTED onwards, but a payslip should
                not reach an employee before the figures are approved. */}
            {canUpdate &&
            (payrun.status === "VALIDATED" || payrun.status === "PAID") ? (
              <ActionButton
                variant="outline"
                startIcon={<Send />}
                action={sendPayslips.bind(null, payrun.id)}
                pendingLabel="Sending"
                confirm={{
                  title: "Send every payslip?",
                  description: `This emails the ${pluralise(
                    payrun.payslipCount,
                    "payslip",
                  )} in this run to the employees they belong to. Sent mail cannot be recalled.`,
                  confirmLabel: "Send payslips",
                }}
              >
                Send payslips
              </ActionButton>
            ) : null}

            {canDelete && payrun.status !== "PAID" ? (
              <ActionButton
                variant="ghost"
                startIcon={<Trash2 />}
                action={deletePayrunAndReturn.bind(null, payrun.id)}
                pendingLabel="Deleting"
                confirm={{
                  title: `Delete ${payrun.name}?`,
                  description: `This removes the run and the ${pluralise(
                    payrun.payslipCount,
                    "payslip",
                  )} in it. It cannot be undone.`,
                  confirmLabel: "Delete",
                  destructive: true,
                }}
              >
                Delete
              </ActionButton>
            ) : null}
          </div>
        }
      />

      <StatGrid>
        <StatTile label="Payslips" value={payrun.payslipCount} />
        <StatTile label="Gross" value={moneyShort(payrun.totalGross)} />
        <StatTile
          label="Deductions"
          value={moneyShort(payrun.totalDeductions)}
        />
        <StatTile
          label="Net"
          value={moneyShort(payrun.totalNet)}
          tone="accent"
        />
      </StatGrid>

      {warnings.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check
            </p>
            <ul className="mt-1 list-disc pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Section title="Run details" description="What this run covers.">
        <FactGrid columns={4}>
          <Fact label="Period">
            {dateRange(payrun.periodStart, payrun.periodEnd)}
          </Fact>
          <Fact label="Salary structure">{payrun.structure.name}</Fact>
          <Fact label="Department filter">{departmentFilter}</Fact>
          <Fact label="Employment type">
            {payrun.employeeTypeFilter
              ? statusLabel(payrun.employeeTypeFilter)
              : "All types"}
          </Fact>
          <Fact label="Created">{formatDate(payrun.createdAt)}</Fact>
          <Fact label="Computed">
            {payrun.computedAt ? formatDate(payrun.computedAt) : "—"}
          </Fact>
          <Fact label="Validated">
            {payrun.validatedAt ? formatDate(payrun.validatedAt) : "—"}
          </Fact>
          <Fact label="Paid">
            {payrun.paidAt ? formatDate(payrun.paidAt) : "—"}
          </Fact>
        </FactGrid>
      </Section>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Payslips</h2>
        {payslips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This run has not produced any payslips yet.
          </p>
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
                      <Badge variant="destructive">{row.warnings.length}</Badge>
                    ) : null}
                    <StatusBadge value={row.status} />
                  </span>
                ),
              },
            ]}
          />
        )}
      </div>
    </>
  );
}
