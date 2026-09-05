import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { can, type PayslipDto } from "@peoplepay360/shared";

import { EmptyState } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireMe } from "@/lib/access";
import { dateRange, money } from "@/lib/format";

import { PdfLink } from "@/app/(app)/payslips/_components/pdf-link";

export const metadata: Metadata = { title: "Pay" };

export default async function MePay() {
  const user = await requireMe();
  if (!can(user.role, "payslips", "read")) redirect("/me");

  let payslips: PayslipDto[] = [];
  try {
    payslips = await apiFetch<PayslipDto[]>("/payslips", {
      query: { employeeId: user.employeeId, limit: 36 },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }

  const [latest, ...earlier] = [...payslips].sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );

  if (!latest) {
    return (
      <EmptyState
        icon={Receipt}
        title="No payslips yet"
        description="Each one appears here once payroll has run, with its PDF."
      />
    );
  }

  return (
    <>
      <h1 className="sr-only">Pay</h1>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Latest · {dateRange(latest.periodStart, latest.periodEnd)}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            {money(latest.netPay)}
          </p>
          <p className="text-sm text-muted-foreground">Net pay</p>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Gross</dt>
              <dd className="font-medium tabular-nums">{money(latest.grossPay)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Deductions</dt>
              <dd className="font-medium tabular-nums">{money(latest.totalDeductions)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex items-center justify-between gap-3">
            <StatusBadge value={latest.status} />
            <PdfLink id={latest.id} label="Download PDF" />
          </div>
        </div>
      </Card>

      {earlier.length > 0 ? (
        <section aria-labelledby="earlier">
          <h2 id="earlier" className="mb-2 text-sm font-medium text-muted-foreground">
            Earlier
          </h2>
          <Card>
            <ul className="divide-y divide-border">
              {earlier.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium tabular-nums">{money(p.netPay)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dateRange(p.periodStart, p.periodEnd)} · {p.number}
                    </p>
                  </div>
                  <StatusBadge value={p.status} />
                  <PdfLink id={p.id} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </>
  );
}
