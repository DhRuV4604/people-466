import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, FileWarning, Landmark } from "lucide-react";
import type { DashboardDto } from "@peoplepay360/shared";

import { DataTable } from "@/components/data/data-table";
import {
  Fact,
  FactGrid,
  Section,
  StatGrid,
  StatTile,
} from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { Badge, Progress } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { formatDate, hours, money, moneyShort, percent } from "@/lib/format";
import { requireAccess } from "@/lib/access";

export const metadata: Metadata = {
  title: "Overview",
  description: "Payroll, attendance and time off at a glance.",
};

export default async function OverviewPage() {
  await requireAccess("dashboard");

  const data = await apiFetch<DashboardDto>("/dashboard");
  const { kpis, alerts, attendance, timeOff } = data;

  const blocking =
    alerts.missingBankDetails.length +
    alerts.noContract.length +
    alerts.duplicatePayslips.length;

  return (
    <>

      <StatGrid>
        <StatTile
          label="Net paid"
          value={moneyShort(kpis.totalNetPaid)}
          hint={`${kpis.payslipsGenerated} payslips`}
        />
        <StatTile
          label="Average salary"
          value={moneyShort(kpis.averageSalary)}
          hint={`${kpis.headcount} on the payroll`}
        />
        <StatTile
          label="Attendance health"
          value={percent(kpis.attendanceHealth)}
          hint={`${attendance.totalRecords} records`}
          tone={kpis.attendanceHealth < 80 ? "danger" : "neutral"}
        />
        <StatTile
          label="Needs attention"
          value={blocking}
          hint={blocking === 0 ? "Nothing blocking" : "Before the next pay run"}
          tone={blocking > 0 ? "danger" : "neutral"}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Section
            title="Salary by department"
            description="Net paid in the current period, and how many people it covers."
          >
            {data.salaryByDepartment.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing has been paid yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {data.salaryByDepartment.map((row) => {
                  const max = Math.max(
                    ...data.salaryByDepartment.map((d) => d.totalNet),
                    1,
                  );
                  return (
                    <li key={row.department} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="truncate">{row.department}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {money(row.totalNet)}
                          <span className="ml-2 text-xs">
                            {row.headcount} people
                          </span>
                        </span>
                      </div>
                      <Progress
                        value={(row.totalNet / max) * 100}
                        className="h-1.5"
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            title="Recent months"
            description="Net salary paid and payslips issued."
          >
            {data.monthlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : (
              <DataTable
                rows={data.monthlyTrend}
                getKey={(row) => row.month}
                columns={[
                  { header: "Month", cell: (row) => row.month },
                  {
                    header: "Payslips",
                    align: "right",
                    cell: (row) => (
                      <span className="tabular-nums">{row.payslips}</span>
                    ),
                  },
                  {
                    header: "Net salary",
                    align: "right",
                    cell: (row) => (
                      <span className="tabular-nums">
                        {money(row.netSalary)}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Section
            title="Needs attention"
            description="Anything here will stop or distort the next pay run."
          >
            <div className="flex flex-col gap-4">
              <AlertRow
                icon={Landmark}
                label="Missing bank details"
                count={alerts.missingBankDetails.length}
                href="/employees?missingBank=true"
                names={alerts.missingBankDetails.map((a) => a.name)}
              />
              <AlertRow
                icon={FileWarning}
                label="No contract"
                count={alerts.noContract.length}
                href="/employees"
                names={alerts.noContract.map((a) => a.name)}
              />
              <AlertRow
                icon={AlertTriangle}
                label="Contracts expiring"
                count={alerts.expiringContracts.length}
                href="/contracts?expiring=true"
                names={alerts.expiringContracts.map(
                  (a) => `${a.name} · ${formatDate(a.dateEnd)}`,
                )}
              />
              <AlertRow
                icon={AlertTriangle}
                label="Duplicate payslips"
                count={alerts.duplicatePayslips.length}
                href="/payslips"
                names={alerts.duplicatePayslips.map((a) => a.employee)}
              />
            </div>
          </Section>

          <Section
            title="Attendance"
            description="Across the records held for this period."
          >
            <FactGrid>
              <Fact label="Present">{attendance.present}</Fact>
              <Fact label="Late">{attendance.late}</Fact>
              <Fact label="Absent">{attendance.absent}</Fact>
              <Fact label="No check-out">{attendance.missingCheckout}</Fact>
              <Fact label="Worked">{hours(attendance.totalWorkedHours)}</Fact>
              <Fact label="Overtime">
                {hours(attendance.totalOvertimeHours)}
              </Fact>
            </FactGrid>
          </Section>

          <Section
            title="Time off"
            description="Approved days and what is still waiting."
          >
            <FactGrid>
              <Fact label="Approved days">{timeOff.approvedDays}</Fact>
              <Fact label="Pending requests">
                {timeOff.pendingRequests > 0 ? (
                  <Link
                    href="/time-off?status=TO_APPROVE"
                    className="text-primary hover:underline"
                  >
                    {timeOff.pendingRequests}
                  </Link>
                ) : (
                  0
                )}
              </Fact>
            </FactGrid>
            {timeOff.byType.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {timeOff.byType.map((type) => (
                  <span
                    key={type.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: type.colorHex }}
                    />
                    {type.name}
                    <span className="text-muted-foreground">{type.days}d</span>
                  </span>
                ))}
              </div>
            ) : null}
          </Section>

          <Section
            title="Pay runs"
            description="Where each run currently sits."
            action={
              <Link
                href="/payruns"
                className="inline-flex shrink-0 items-center gap-1.5 rounded text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                Open
                <ArrowRight className="size-4" />
              </Link>
            }
          >
            <div className="flex flex-wrap gap-2">
              {data.payrunStatusBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pay runs yet.
                </p>
              ) : (
                data.payrunStatusBreakdown.map((row) => (
                  <span
                    key={row.status}
                    className="inline-flex items-center gap-2"
                  >
                    <StatusBadge value={row.status} />
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {row.count}
                    </span>
                  </span>
                ))
              )}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function AlertRow({
  icon: Icon,
  label,
  count,
  href,
  names,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
  names: string[];
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className={
          count > 0
            ? "mt-0.5 size-4 shrink-0 text-destructive"
            : "mt-0.5 size-4 shrink-0 text-muted-foreground"
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link href={href} className="text-sm hover:underline">
            {label}
          </Link>
          <Badge variant={count > 0 ? "destructive" : "outline"}>{count}</Badge>
        </div>
        {names.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {names.slice(0, 3).join(", ")}
            {names.length > 3 ? ` +${names.length - 3} more` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
