import { Suspense } from "react";
import type { Metadata } from "next";

import { StatGrid, StatTile } from "@/components/data/primitives";
import { OverviewSkeleton, StatsSkeleton } from "@/components/data/skeletons";
import { hours, moneyShort, percent } from "@/lib/format";
import { requireAccess } from "@/lib/access";

import { getDashboard } from "./dashboard-data";
import { OverviewBody } from "./_components/overview-body";
import { TaskStrip } from "./_components/task-strip";

export const metadata: Metadata = {
  title: "Overview",
  description: "Payroll, attendance and time off at a glance.",
};

/**
 * The overview streams in two parts. The headline figures are what the page is
 * for, so they get their own boundary and paint first; the panels below follow
 * without holding up the shell. Both read the same cached payload, so this is
 * one API call rendered in two stages rather than two calls.
 */
export default async function OverviewPage() {
  await requireAccess("dashboard");

  return (
    <>
      {/* What needs doing comes before what has happened: the numbers below
          describe the month, and these are the things that will spoil the next
          one if nobody touches them. */}
      <Suspense fallback={<TaskStripSkeleton />}>
        <OverviewTasks />
      </Suspense>

      <Suspense fallback={<StatsSkeleton />}>
        <OverviewStats />
      </Suspense>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewBody />
      </Suspense>
    </>
  );
}

async function OverviewTasks() {
  const { tasks, period } = await getDashboard();
  return <TaskStrip tasks={tasks} period={period.label} />;
}

/** Matches the card row, so the page does not jump when it arrives. */
function TaskStripSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-5 w-56 animate-pulse rounded bg-muted" />
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[186px] min-w-56 flex-1 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    </div>
  );
}

async function OverviewStats() {
  const { kpis, attendance, period } = await getDashboard();

  // Deductions as a share of gross, which is the number a payroll manager is
  // actually asked about — "where did the rest of it go".
  const deductionShare =
    kpis.totalGross > 0 ? (kpis.totalDeductions / kpis.totalGross) * 100 : 0;

  return (
    <StatGrid>
      <StatTile
        label="Net paid"
        value={moneyShort(kpis.totalNetPaid)}
        hint={`${kpis.payslipsGenerated} payslips · ${period.label}`}
      />
      <StatTile
        label="Cost to company"
        value={moneyShort(kpis.totalGross)}
        hint={`${moneyShort(kpis.totalDeductions)} deducted · ${percent(deductionShare)}`}
      />
      <StatTile
        label="Average salary"
        value={moneyShort(kpis.averageSalary)}
        hint={`${kpis.headcount} on the payroll`}
      />
      <StatTile
        label="Attendance health"
        value={percent(kpis.attendanceHealth)}
        hint={`${attendance.totalRecords} records · ${hours(attendance.totalOvertimeHours)} overtime`}
        tone={kpis.attendanceHealth < 80 ? "danger" : "neutral"}
      />
    </StatGrid>
  );
}
