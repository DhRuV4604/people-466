import { Suspense } from "react";
import type { Metadata } from "next";

import { StatGrid, StatTile } from "@/components/data/primitives";
import { OverviewSkeleton, StatsSkeleton } from "@/components/data/skeletons";
import { moneyShort, percent } from "@/lib/format";
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
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[124px] w-56 shrink-0 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

async function OverviewStats() {
  const { kpis, alerts, attendance } = await getDashboard();

  const blocking =
    alerts.missingBankDetails.length +
    alerts.noContract.length +
    alerts.duplicatePayslips.length;

  return (
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
  );
}
