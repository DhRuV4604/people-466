import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import type {
  AttendanceDto,
  AttendanceSummaryDto,
  Paginated,
  PunchStatusDto,
} from "@peoplepay360/shared";
import { DEFAULT_APP_SETTINGS } from "@peoplepay360/shared";

import { EmptyState } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireMe } from "@/lib/access";
import { ALL_ROWS, emptyPage } from "@/lib/paged";
import { formatTime, hours } from "@/lib/format";

import { PunchCard } from "../_components/punch-card";
import { dayKey, openShift, shortDay, thisMonth, today } from "../_lib";

export const metadata: Metadata = { title: "Attendance" };

async function soft<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return fallback;
    throw error;
  }
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 p-4">
      <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function MeAttendance() {
  const user = await requireMe();
  const month = thisMonth();
  const query = { employeeId: user.employeeId, from: month.from, to: month.to };

  const [rowPage, summary, punches] = await Promise.all([
    soft(
      apiFetch<Paginated<AttendanceDto>>("/attendance", {
        query: { ...query, pageSize: ALL_ROWS },
      }),
      emptyPage<AttendanceDto>(),
    ),
    soft(apiFetch<AttendanceSummaryDto | null>("/attendance/summary", { query }), null),
    // The day's cap, so the card can say what is left before it is tapped.
    soft(apiFetch<PunchStatusDto>("/attendance/punch-status"), {
      used: 0,
      allowed: DEFAULT_APP_SETTINGS.maxCheckInsPerDay,
      remaining: 0,
      warnOnCheckOut: DEFAULT_APP_SETTINGS.warnOnCheckOut,
    }),
  ]);

  const rows = rowPage.items;
  const open = openShift(rows);
  const workedToday = rows
    .filter((r) => dayKey(r.checkIn) === today() && r.checkOut)
    .reduce((sum, r) => sum + r.workedHours, 0);

  const byDay = [...rows].sort((a, b) => b.checkIn.localeCompare(a.checkIn));

  return (
    <>
      <h1 className="sr-only">Attendance</h1>

      <PunchCard
        open={open ? { checkIn: open.checkIn } : null}
        workedToday={workedToday}
        punches={punches}
      />

      <section aria-labelledby="month">
        <h2 id="month" className="mb-2 text-sm font-medium text-muted-foreground">
          {month.label}
        </h2>
        <Card className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0 [&>*:nth-child(3)]:border-l-0 sm:[&>*:nth-child(3)]:border-l">
          <Figure label="Hours worked" value={hours(summary?.totalWorkedHours ?? 0)} />
          <Figure label="Days present" value={summary?.present ?? 0} />
          <Figure label="Late arrivals" value={summary?.late ?? 0} />
          <Figure label="Overtime" value={hours(summary?.totalOvertimeHours ?? 0)} />
        </Card>
      </section>

      {byDay.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing recorded this month"
          description="Your first check-in will start the list."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {byDay.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-4">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-medium">{shortDay(r.checkIn)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums">
                    {formatTime(r.checkIn)}
                    <span className="text-muted-foreground"> → </span>
                    {r.checkOut ? formatTime(r.checkOut) : (
                      <span className="text-primary">running</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {r.checkOut ? hours(r.workedHours) : "—"}
                    {r.overtimeHours > 0 ? ` · ${hours(r.overtimeHours)} overtime` : ""}
                    {r.manuallyEdited ? " · corrected" : ""}
                  </p>
                </div>
                <StatusBadge value={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">Times are UTC.</p>
    </>
  );
}
