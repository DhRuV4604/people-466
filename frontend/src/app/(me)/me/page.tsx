import Link from "next/link";
import { ArrowRight, CalendarOff, ChevronRight, Receipt } from "lucide-react";
import type {
  AttendanceDto,
  LeaveBalanceDto,
  LeaveRequestDto,
  PayslipDto,
  PunchStatusDto,
  TimeOffTypeDto,
} from "@peoplepay360/shared";
import { DEFAULT_APP_SETTINGS, can } from "@peoplepay360/shared";

import { StatusBadge } from "@/components/data/status-badge";
import { RecordDialog } from "@/components/form";
import { Button, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireMe } from "@/lib/access";
import { dateRange, formatDate, money, pluralise } from "@/lib/format";

import { PdfLink } from "@/app/(app)/payslips/_components/pdf-link";
import { PunchCard } from "./_components/punch-card";
import { requestLeave } from "./actions";
import { leaveFields } from "./fields";
import { dayKey, firstName, openShift, thisMonth, today } from "./_lib";

/** A list a role may not be allowed to read still leaves the page standing. */
async function soft<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return fallback;
    throw error;
  }
}

export default async function MeHome() {
  const user = await requireMe();
  const month = thisMonth();
  const canSeePay = can(user.role, "payslips", "read");

  const [attendance, punches, balances, requests, types, payslips] = await Promise.all([
    soft(
      apiFetch<AttendanceDto[]>("/attendance", {
        query: { employeeId: user.employeeId, from: month.from, to: month.to, limit: 100 },
      }),
      [],
    ),
    // Where they stand against the day's cap. A role the endpoint refuses
    // falls back to a spent day, which only ever hides the button.
    soft(apiFetch<PunchStatusDto>("/attendance/punch-status"), {
      used: 0,
      allowed: DEFAULT_APP_SETTINGS.maxCheckInsPerDay,
      remaining: 0,
      warnOnCheckOut: DEFAULT_APP_SETTINGS.warnOnCheckOut,
    }),
    soft(apiFetch<LeaveBalanceDto[]>(`/time-off/balances/${user.employeeId}`), []),
    soft(
      apiFetch<LeaveRequestDto[]>("/time-off/requests", {
        query: { employeeId: user.employeeId, limit: 50 },
      }),
      [],
    ),
    soft(apiFetch<TimeOffTypeDto[]>("/time-off/types"), []),
    canSeePay
      ? soft(
          apiFetch<PayslipDto[]>("/payslips", {
            query: { employeeId: user.employeeId, limit: 1 },
          }),
          [],
        )
      : Promise.resolve([] as PayslipDto[]),
  ]);

  const open = openShift(attendance);
  const workedToday = attendance
    .filter((row) => dayKey(row.checkIn) === today() && row.checkOut)
    .reduce((sum, row) => sum + row.workedHours, 0);

  const pending = requests.filter((r) => r.status === "TO_APPROVE");
  const upcoming = requests
    .filter((r) => r.status === "APPROVED" && dayKey(r.dateTo) >= today())
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))[0];

  // Only types with something to draw from are worth a tile on the front page;
  // the leave screen lists every one.
  const tiles = balances.filter((b) => b.requiresAllocation || b.taken > 0);
  const latest = payslips[0];

  const leaveTypeOptions = types
    .filter((t) => t.active)
    .map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {firstName(user.name)}
        </h1>
        <p className="text-sm text-muted-foreground">{formatDate(today())}</p>
      </div>

      <PunchCard
        open={open ? { checkIn: open.checkIn } : null}
        workedToday={workedToday}
        punches={punches}
      />

      {/* Balances scroll sideways on a phone rather than stacking: five tiles
          stacked would push everything else below the fold. */}
      <section aria-labelledby="balances">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="balances" className="text-sm font-medium text-muted-foreground">
            Leave left
          </h2>
          <Link
            href="/me/leave"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            All leave <ChevronRight className="size-3.5" />
          </Link>
        </div>
        {tiles.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            No leave has been allocated to you yet.
          </Card>
        ) : (
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tiles.map((b) => (
              <li key={b.typeId} className="snap-start">
                <Card className="w-36 shrink-0 p-4">
                  <span
                    aria-hidden
                    className="mb-3 block h-1 w-8 rounded-full"
                    style={{ backgroundColor: b.colorHex }}
                  />
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {b.requiresAllocation ? b.remaining : b.taken}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.requiresAllocation
                      ? `${b.unit === "HOUR" ? "hours" : "days"} left`
                      : `${b.unit === "HOUR" ? "hours" : "days"} taken`}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">{b.typeName}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecordDialog
        title="Request leave"
        description="Your manager is told the moment you send it."
        fields={leaveFields(leaveTypeOptions)}
        action={requestLeave}
        submitLabel="Send request"
        trigger={
          <Button
            variant="outline"
            size="lg"
            fullWidth
            className="h-13 rounded-2xl"
            startIcon={<CalendarOff />}
          >
            Request leave
          </Button>
        }
      />

      {(upcoming || pending.length > 0) ? (
        <Card className="divide-y divide-border">
          {upcoming ? (
            <div className="flex items-start gap-3 p-4">
              <span
                aria-hidden
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: upcoming.type.colorHex }}
              />
              <div className="min-w-0 flex-1">
                {/* The type and the dates are separate lines: a full range plus
                    a badge on one row wraps into a mess on a narrow phone. */}
                <p className="truncate text-sm font-medium">{upcoming.type.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dateRange(upcoming.dateFrom, upcoming.dateTo)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Coming up ·{" "}
                  {pluralise(
                    upcoming.duration,
                    upcoming.type.unit === "HOUR" ? "hour" : "day",
                  )}
                </p>
              </div>
              <StatusBadge value={upcoming.status} />
            </div>
          ) : null}
          {pending.length > 0 ? (
            <Link
              href="/me/leave"
              className="flex items-center gap-3 p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {pluralise(pending.length, "request")} awaiting approval
                </p>
                <p className="text-xs text-muted-foreground">
                  {pending.map((r) => r.type.name).join(", ")}
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ) : null}
        </Card>
      ) : null}

      {canSeePay ? (
        <section aria-labelledby="pay">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="pay" className="text-sm font-medium text-muted-foreground">
              Latest payslip
            </h2>
            <Link
              href="/me/pay"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              All payslips <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {latest ? (
            <Card className="flex items-center gap-4 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Receipt className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold tracking-tight tabular-nums">
                  {money(latest.netPay)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {dateRange(latest.periodStart, latest.periodEnd)} · net
                </p>
              </div>
              <PdfLink id={latest.id} />
            </Card>
          ) : (
            <Card className="p-4 text-sm text-muted-foreground">
              No payslip has been issued yet.
            </Card>
          )}
        </section>
      ) : null}
    </>
  );
}
