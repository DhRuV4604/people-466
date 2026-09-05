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
import {
  can,
  type EmailLogDto,
  type PayrunDto,
  type PayrunStatus,
  type Paginated,
  type PayslipDto,
} from "@peoplepay360/shared";

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
import { BreadcrumbTitle } from "@/components/app/breadcrumb-title";
import { Badge, PageHeader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import {
  dateRange,
  formatDate,
  formatTime,
  money,
  moneyShort,
  pluralise,
} from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { statusLabel } from "@/lib/status";
import { requireAccess } from "@/lib/access";
import { ALL_ROWS } from "@/lib/paged";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";

import {
  computePayrun,
  deletePayrunAndReturn,
  markPayrunPaid,
  sendPayslips,
  validatePayrun,
} from "../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

async function getPayrun(id: string): Promise<PayrunDto | null> {
  try {
    return await apiFetch<PayrunDto>(`/payruns/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Mirrors the `take` in the API's findLogs(): the outbox is not paginated. */
/** What one read of the outbox can carry, matching the API's page ceiling. */
const OUTBOX_LIMIT = 500;

type Outbox = {
  attempts: EmailLogDto[];
  /** The response came back at the cap, so older attempts may be cut off. */
  partial: boolean;
  /** The outbox could not be read at all. */
  unavailable: boolean;
};

/**
 * The outbox for one run. `/email-logs` has no per-run filter, so this reads a
 * page of the whole outbox and picks this run's attempts out of it.
 *
 * The endpoint reports how many rows exist in total, so "did the window cut
 * some off" is now a fact rather than a guess: if the total exceeds what came
 * back, older attempts are out of reach and the panel says so instead of
 * presenting a partial list as the whole story.
 */
async function getDeliveries(payrun: PayrunDto): Promise<Outbox> {
  try {
    const outbox = await apiFetch<Paginated<EmailLogDto>>("/email-logs", {
      query: { pageSize: ALL_ROWS },
    });

    return {
      attempts: outbox.items.filter((log) => log.payrunId === payrun.id),
      partial: outbox.total > outbox.items.length,
      unavailable: false,
    };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // Delivery is a footnote to the run. Losing it should not cost the reader
    // the figures they came for.
    return { attempts: [], partial: false, unavailable: true };
  }
}

export async function generateMetadata({
  params,
}: Pick<PageProps, "params">): Promise<Metadata> {
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

export default async function PayrunPage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireAccess("payruns");

  const { id } = await params;
  const query = await searchParams;
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

  // The outbox is a payslips permission, not a payruns one, so a role that can
  // open the run is not guaranteed to be allowed the delivery record. The API
  // refuses to send from a draft, so delivery is not yet a question there.
  const outbox =
    payrun.status !== "DRAFT" && can(session.role, "payslips", "read")
      ? await getDeliveries(payrun)
      : null;

  return (
    <>
      <BreadcrumbTitle>{payrun.name}</BreadcrumbTitle>

      <PageHeader
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

      {/* "Have these gone out?" is answered whether or not they have: an
          absent panel would read as a missing panel, not as a no. */}
      <PayslipTable
        payslips={payslips}
        outbox={outbox}
        page={pageQuery(query)}
      />
    </>
  );
}

/**
 * The run's payslips, each carrying what became of the email for it.
 *
 * These were two tables listing the same people twice: one of payslips, one of
 * delivery attempts. Reading "did Priya get hers" meant finding her in both.
 * One row per payslip answers it in a glance, and the delivery column is the
 * only place the outbox is needed.
 */
function PayslipTable({
  payslips,
  outbox,
  page,
}: {
  payslips: PayslipDto[];
  outbox: Outbox | null;
  page: { page: number; pageSize: number };
}) {
  // The newest attempt per payslip. Sending again records a fresh attempt
  // rather than replacing the last, so the latest one is the current answer.
  const latest = new Map<string, EmailLogDto>();
  for (const attempt of outbox?.attempts ?? []) {
    if (!attempt.payslipId) continue;
    const held = latest.get(attempt.payslipId);
    if (!held || attempt.sentAt > held.sentAt) latest.set(attempt.payslipId, attempt);
  }

  const sent = [...latest.values()].filter((a) => a.status === "SENT").length;
  const failed = [...latest.values()].filter((a) => a.status === "FAILED").length;

  const total = payslips.length;
  const totalPages = Math.max(1, Math.ceil(total / page.pageSize));
  // A page number past the end is a stale link, not an error: show the last.
  const current = Math.min(page.page, totalPages);
  const rows = payslips.slice(
    (current - 1) * page.pageSize,
    current * page.pageSize,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Payslips</h2>
        {outbox && latest.size > 0 ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {sent} emailed
            {failed > 0 ? (
              <span className="font-medium text-destructive"> · {failed} failed</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {outbox?.unavailable ? (
        <p className="text-xs text-muted-foreground">
          The delivery record could not be read, so the last column cannot say
          whether these were emailed.
        </p>
      ) : null}

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          This run has not produced any payslips yet.
        </p>
      ) : (
        <>
          <DataTable
            rows={rows}
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
              {
                header: "Delivery",
                align: "right",
                hideBelow: "md",
                cell: (row) => {
                  const attempt = latest.get(row.id);
                  if (!attempt) {
                    return (
                      <span className="text-xs text-muted-foreground">
                        Not sent
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <StatusBadge value={attempt.status} />
                      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatDate(attempt.sentAt)} · {formatTime(attempt.sentAt)}
                      </span>
                      {/* A failure whose reason is hidden is the reason this
                          column exists, so the API's own text is printed. */}
                      {attempt.error ? (
                        <span className="max-w-56 text-xs text-destructive">
                          {attempt.error}
                        </span>
                      ) : null}
                    </span>
                  );
                },
              },
            ]}
          />

          <Pagination
            meta={{
              total,
              page: current,
              pageSize: page.pageSize,
              totalPages,
            }}
            noun="payslip"
          />
        </>
      )}

      {outbox?.partial ? (
        <p className="text-xs text-muted-foreground">
          The outbox holds the most recent {OUTBOX_LIMIT} attempts across every
          pay run, so an earlier attempt for this one may be missing.
        </p>
      ) : null}
    </div>
  );
}

