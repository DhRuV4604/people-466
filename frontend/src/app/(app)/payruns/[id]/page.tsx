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
import { BackLink, Badge, PageHeader } from "@/components/ui";
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

/** Mirrors the `take` in the API's findLogs(): the outbox is not paginated. */
const OUTBOX_LIMIT = 200;

type Outbox = {
  attempts: EmailLogDto[];
  /** The response came back at the cap, so older attempts may be cut off. */
  partial: boolean;
  /** The outbox could not be read at all. */
  unavailable: boolean;
};

/**
 * The outbox for one run. `/email-logs` takes no query and returns only the
 * most recent 200 attempts across every run, so this run's are picked out
 * here, and a window that could have cut some of them off is reported as
 * incomplete rather than passed off as the whole story.
 */
async function getDeliveries(payrun: PayrunDto): Promise<Outbox> {
  try {
    const logs = await apiFetch<EmailLogDto[]>("/email-logs");

    // Rows fall off the old end of that window. Nothing for this run can have
    // been lost while the window still reaches back past the run's own
    // creation, which keeps the warning off every page of a busy outbox and
    // on the runs where it is actually true. Both are ISO UTC, so comparing
    // them as strings is comparing the instants.
    const oldest = logs.reduce<string | null>(
      (earliest, log) =>
        earliest === null || log.sentAt < earliest ? log.sentAt : earliest,
      null,
    );

    return {
      attempts: logs.filter((log) => log.payrunId === payrun.id),
      partial:
        logs.length >= OUTBOX_LIMIT &&
        oldest !== null &&
        oldest > payrun.createdAt,
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

  // The outbox is a payslips permission, not a payruns one, so a role that can
  // open the run is not guaranteed to be allowed the delivery record. The API
  // refuses to send from a draft, so delivery is not yet a question there.
  const outbox =
    payrun.status !== "DRAFT" && can(session.role, "payslips", "read")
      ? await getDeliveries(payrun)
      : null;

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

      {/* "Have these gone out?" is answered whether or not they have: an
          absent panel would read as a missing panel, not as a no. */}
      {outbox ? <PayslipDelivery outbox={outbox} /> : null}

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

/**
 * Who each payslip was emailed to and what came of it. Sending again records a
 * fresh attempt rather than replacing the last one, so a run can carry several
 * attempts for the same person and the newest is at the top.
 */
function PayslipDelivery({ outbox }: { outbox: Outbox }) {
  const { partial, unavailable } = outbox;

  // Sorted here rather than trusted from the API, so "most recent first" and
  // "last attempt" stay true however the endpoint chooses to order itself.
  const attempts = [...outbox.attempts].sort((a, b) =>
    b.sentAt.localeCompare(a.sentAt),
  );
  const sent = attempts.filter((attempt) => attempt.status === "SENT").length;
  const failed = attempts.filter(
    (attempt) => attempt.status === "FAILED",
  ).length;

  if (attempts.length === 0) {
    return (
      <Section title="Payslip delivery">
        <p className="text-sm text-muted-foreground">
          {unavailable
            ? "The delivery record could not be read, so whether these payslips have been emailed is not known."
            : partial
              ? `Nothing for this run is in the outbox, but the outbox only keeps the most recent ${OUTBOX_LIMIT} attempts across every pay run, so an earlier send may have dropped out of it.`
              : "No payslip from this run has been emailed yet."}
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Payslip delivery"
      description="Every attempt to email a payslip from this run, most recent first."
    >
      <FactGrid columns={4}>
        <Fact label="Attempts">{attempts.length}</Fact>
        <Fact label="Sent">{sent}</Fact>
        <Fact label="Failed">
          <span
            className={failed > 0 ? "font-medium text-destructive" : undefined}
          >
            {failed}
          </span>
        </Fact>
        <Fact label="Last attempt">
          {`${formatDate(attempts[0].sentAt)} · ${formatTime(attempts[0].sentAt)}`}
        </Fact>
      </FactGrid>

      {/* The endpoint has no filter and no paging, so once it is full these
          counts are a floor rather than the total. Saying so beats quietly
          under-reporting a send. */}
      {partial ? (
        <p className="mt-4 text-xs text-muted-foreground">
          The outbox only keeps the most recent {OUTBOX_LIMIT} attempts across
          every pay run, so an earlier attempt for this run may be missing from
          these figures.
        </p>
      ) : null}

      <DataTable
        className="mt-4"
        rows={attempts}
        getKey={(row) => row.id}
        columns={[
          {
            header: "Recipient",
            className: "min-w-[240px]",
            cell: (row) => (
              <>
                {/* An attempt with no name on it is identified by the address
                    alone, rather than printing it twice. */}
                <PersonCell
                  name={row.toName ?? row.toEmail}
                  meta={row.toName ? row.toEmail : null}
                />
                {/* A failure whose reason is hidden is the reason this panel
                    exists, so the API's own text is printed on the row. */}
                {row.error ? (
                  <p className="mt-1 text-xs text-destructive">{row.error}</p>
                ) : null}
              </>
            ),
          },
          {
            header: "Attempted",
            hideBelow: "sm",
            cell: (row) => (
              <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                {formatDate(row.sentAt)} · {formatTime(row.sentAt)}
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
    </Section>
  );
}
