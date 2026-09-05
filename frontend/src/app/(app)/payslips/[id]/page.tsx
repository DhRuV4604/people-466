import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { can, isNegativeCategory, type PayslipDto } from "@peoplepay360/shared";

import {
  Fact,
  FactGrid,
  Section,
  StatGrid,
  StatTile,
} from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { ActionButton } from "@/components/form";
import { BreadcrumbTitle } from "@/components/app/breadcrumb-title";
import { PageHeader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { dateRange, hours, money } from "@/lib/format";
import { requireAccess } from "@/lib/access";
import { cn } from "@/lib/utils";

import { PdfLink } from "../_components/pdf-link";
import { recomputePayslip } from "../actions";

type PageProps = { params: Promise<{ id: string }> };

async function getPayslip(id: string): Promise<PayslipDto | null> {
  try {
    return await apiFetch<PayslipDto>(`/payslips/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const payslip = await getPayslip(id);
  return { title: payslip?.number ?? "Payslip" };
}

export default async function PayslipPage({ params }: PageProps) {
  const session = await requireAccess("payslips");

  const { id } = await params;
  const payslip = await getPayslip(id);
  if (!payslip) notFound();

  const lines = [...(payslip.lines ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );

  // The API refuses to recompute a paid payslip, so the button is not offered
  // once the money has gone out.
  const canRecompute =
    can(session.role, "payslips", "update") && payslip.status !== "PAID";

  return (
    <>
      {/* The number is the stable identifier, so it names the crumb even when
          the payslip has an employee to show in the heading. */}
      <BreadcrumbTitle>{payslip.number}</BreadcrumbTitle>

      <PageHeader
        title={payslip.employee?.fullName ?? payslip.number}
        description={`${payslip.number} · ${dateRange(payslip.periodStart, payslip.periodEnd)}`}
        actions={
          <>
            <StatusBadge value={payslip.status} />
            {canRecompute ? (
              <ActionButton
                variant="outline"
                startIcon={<RefreshCw />}
                action={recomputePayslip.bind(null, payslip.id)}
                pendingLabel="Recomputing"
                confirm={{
                  title: "Recompute this payslip?",
                  description:
                    "Every line is built again from the salary rules and the contract as they stand now. Whatever the pay run produced is discarded, and the totals may come out different.",
                  confirmLabel: "Recompute",
                  destructive: true,
                }}
              >
                Recompute
              </ActionButton>
            ) : null}
            <PdfLink id={payslip.id} label="PDF" />
          </>
        }
      />

      {payslip.warnings.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Computed from incomplete data</p>
            <ul className="mt-1 list-disc pl-4">
              {/* Two rules can fail the same way, so a warning is not unique
                  and cannot be its own key. */}
              {payslip.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <StatGrid>
        <StatTile label="Basic" value={money(payslip.basicWage)} />
        <StatTile label="Gross" value={money(payslip.grossPay)} />
        <StatTile
          label="Deductions"
          value={money(payslip.totalDeductions)}
          tone="danger"
        />
        <StatTile label="Net pay" value={money(payslip.netPay)} tone="accent" />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section
          title="Breakdown"
          description="Every rule that fired, in the order the engine applied it."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 text-xs font-medium text-muted-foreground">
                    Rule
                  </th>
                  <th className="hidden py-2 pr-4 text-xs font-medium text-muted-foreground sm:table-cell">
                    Category
                  </th>
                  <th className="py-2 pr-4 text-right text-xs font-medium text-muted-foreground">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const negative = isNegativeCategory(line.category);
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="block">{line.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {line.code}
                        </span>
                      </td>
                      <td className="hidden py-2.5 pr-4 sm:table-cell">
                        <StatusBadge value={line.category} />
                      </td>
                      <td
                        className={cn(
                          "py-2.5 pr-4 text-right tabular-nums",
                          negative && "text-destructive",
                        )}
                      >
                        {negative ? "−" : ""}
                        {money(Math.abs(line.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="py-3 pr-4 font-medium">Net pay</td>
                  {/* Mirrors the category cell rather than spanning it: below
                      sm that column is not rendered at all, and a colspan
                      would push the total out of the amount column. */}
                  <td className="hidden sm:table-cell" />
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                    {money(payslip.netPay)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        <Section title="Context" description="What the figures were based on.">
          <FactGrid columns={2}>
            <Fact label="Employee">
              {payslip.employeeId ? (
                <Link
                  href={`/employees/${payslip.employeeId}`}
                  className="text-primary hover:underline"
                >
                  {payslip.employee?.fullName ?? "Open"}
                </Link>
              ) : (
                (payslip.employee?.fullName ?? "—")
              )}
            </Fact>
            <Fact label="Code">{payslip.employee?.employeeCode}</Fact>
            <Fact label="Department">{payslip.employee?.department}</Fact>
            <Fact label="Position">{payslip.employee?.jobPosition}</Fact>
            <Fact label="Structure">{payslip.structure.name}</Fact>
            <Fact label="Contract">{payslip.contract?.name}</Fact>
            <Fact label="Pay run">
              {payslip.payrun ? (
                <Link
                  href={`/payruns/${payslip.payrun.id}`}
                  className="text-primary hover:underline"
                >
                  {payslip.payrun.name}
                </Link>
              ) : (
                "—"
              )}
            </Fact>
            <Fact label="Worked days">{payslip.workedDays}</Fact>
            <Fact label="Worked hours">{hours(payslip.workedHours)}</Fact>
            <Fact label="Overtime">{hours(payslip.overtimeHours)}</Fact>
            <Fact label="Leave days">{payslip.leaveDays}</Fact>
          </FactGrid>
        </Section>
      </div>
    </>
  );
}
