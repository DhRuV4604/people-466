import Link from "next/link";
import { CalendarOff, ChevronRight, Receipt } from "lucide-react";
import type {
  AttendanceDto,
  DocumentDto,
  LeaveBalanceDto,
  LeaveRequestDto,
  PayslipDto,
  PunchStatusDto,
  TimeOffTypeDto,
  Paginated,
} from "@peoplepay360/shared";
import { DEFAULT_APP_SETTINGS, can } from "@peoplepay360/shared";

import { StatusBadge } from "@/components/data/status-badge";
import { RecordDialog } from "@/components/form";
import { Button, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireMe } from "@/lib/access";
import { emptyPage } from "@/lib/paged";
import { dateRange, formatDate, hours, money, pluralise } from "@/lib/format";

import { PdfLink } from "@/app/(app)/payslips/_components/pdf-link";
import { PunchCard } from "./_components/punch-card";
import { NeedsYou } from "./_components/needs-you";
import { requestLeave } from "./actions";
import { leaveFields } from "./fields";
import { dayKey, firstName, thisMonth, today } from "./_lib";

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

  const [
    attendancePage,
    punches,
    balances,
    requestPage,
    typePage,
    payslipPage,
    documentPage,
  ] = await Promise.all([
      soft(
        apiFetch<Paginated<AttendanceDto>>("/attendance", {
          query: {
            employeeId: user.employeeId,
            from: month.from,
            to: month.to,
            pageSize: 100,
          },
        }),
        emptyPage(),
      ),
      // Where they stand against the day's cap. A role the endpoint refuses
      // falls back to a spent day, which only ever hides the button.
      soft(apiFetch<PunchStatusDto>("/attendance/punch-status"), {
        used: 0,
        allowed: DEFAULT_APP_SETTINGS.maxCheckInsPerDay,
        remaining: 0,
        warnOnCheckOut: DEFAULT_APP_SETTINGS.warnOnCheckOut,
        openCheckIn: null,
      }),
      soft(apiFetch<LeaveBalanceDto[]>(`/time-off/balances/${user.employeeId}`), []),
      soft(
        apiFetch<Paginated<LeaveRequestDto>>("/time-off/requests", {
          query: { employeeId: user.employeeId, pageSize: 50 },
        }),
        emptyPage(),
      ),
      soft(
        apiFetch<Paginated<TimeOffTypeDto>>("/time-off/types", {
          query: { pageSize: 100 },
        }),
        emptyPage(),
      ),
      canSeePay
        ? soft(
            apiFetch<Paginated<PayslipDto>>("/payslips", {
              query: { employeeId: user.employeeId, pageSize: 1 },
            }),
            emptyPage(),
          )
        : Promise.resolve(emptyPage<PayslipDto>()),
      // The API already narrows this to their own file, and to the statuses
      // they are meant to see.
      soft(
        apiFetch<Paginated<DocumentDto>>("/documents", {
          query: { pageSize: 50 },
        }),
        emptyPage<DocumentDto>(),
      ),
    ]);

  const attendance = attendancePage.items;
  const requests = requestPage.items;
  const types = typePage.items;
  const payslips = payslipPage.items;

  const workedToday = attendance
    .filter((row) => dayKey(row.checkIn) === today() && row.checkOut)
    .reduce((sum, row) => sum + row.workedHours, 0);

  // The month so far, from punches already fetched for the card above. It
  // costs nothing extra and gives the rail something true to say on a day
  // where there is no payslip and nothing outstanding.
  const monthHours = attendance.reduce((sum, row) => sum + row.workedHours, 0);
  const daysPresent = new Set(
    attendance.filter((row) => row.checkOut).map((row) => dayKey(row.checkIn)),
  ).size;

  const pending = requests.filter((r) => r.status === "TO_APPROVE");
  const upcoming = requests
    .filter((r) => r.status === "APPROVED" && dayKey(r.dateTo) >= today())
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))[0];

  // Only types with something to draw from are worth a tile on the front page;
  // the leave screen lists every one.
  const tiles = balances.filter((b) => b.requiresAllocation || b.taken > 0);
  const latest = payslips[0];

  // Anything the person has to act on. Ordered so a signature — which blocks
  // somebody else — comes before a request for a file, which blocks nobody.
  const waiting = documentPage.items
    .filter((d) => d.status === "AWAITING_SIGNATURE" || d.status === "REQUESTED")
    .sort((a, b) =>
      a.status === b.status ? 0 : a.status === "AWAITING_SIGNATURE" ? -1 : 1,
    );

  const leaveTypeOptions = types
    .filter((t) => t.active)
    .map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {firstName(user.name)}
        </h1>
        <p className="text-sm text-muted-foreground">{formatDate(today())}</p>
      </div>

      {/* What is waiting on them, before anything describing them. Documents
          lead it: they are the item most often outstanding and the one with no
          other prompt anywhere in this space. */}
      <NeedsYou documents={waiting} pending={pending} />

      {/* From md the screen stops being a column. The clock and the leave
          balances are the two things looked at daily, so they take the wide
          half; pay and what is coming up sit beside them rather than a screen
          further down. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2 xl:col-span-2">
          <PunchCard
            open={
              punches.openCheckIn
                ? { checkIn: punches.openCheckIn.checkIn }
                : null
            }
            workedToday={workedToday}
            punches={punches}
          />

          <section aria-labelledby="balances">
            <div className="mb-2 flex items-center justify-between">
              <h2
                id="balances"
                className="text-sm font-medium text-muted-foreground"
              >
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
              /* Scrolls sideways on a phone, where stacking five tiles would
                 push everything else below the fold; a plain grid from sm up,
                 where there is room for them all. */
              <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                {tiles.map((b) => (
                  <li key={b.typeId} className="snap-start">
                    <Card className="w-36 shrink-0 p-4 sm:w-auto">
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
                      <p className="mt-1 truncate text-sm font-medium">
                        {b.typeName}
                      </p>
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
        </div>

        {/* The rail: what is settled rather than what is happening. */}
        <div className="flex min-w-0 flex-col gap-4">
          {canSeePay ? (
            <section aria-labelledby="pay">
              <div className="mb-2 flex items-center justify-between">
                <h2
                  id="pay"
                  className="text-sm font-medium text-muted-foreground"
                >
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

          <section aria-labelledby="month">
            <h2
              id="month"
              className="mb-2 text-sm font-medium text-muted-foreground"
            >
              This month
            </h2>
            <Card className="grid grid-cols-2 gap-4 p-4">
              <div>
                <p className="text-xl font-semibold tracking-tight tabular-nums">
                  {hours(monthHours)}
                </p>
                <p className="text-xs text-muted-foreground">worked</p>
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight tabular-nums">
                  {daysPresent}
                </p>
                <p className="text-xs text-muted-foreground">
                  {daysPresent === 1 ? "day recorded" : "days recorded"}
                </p>
              </div>
            </Card>
          </section>

          {upcoming ? (
            <section aria-labelledby="upcoming">
              <h2
                id="upcoming"
                className="mb-2 text-sm font-medium text-muted-foreground"
              >
                Coming up
              </h2>
              <Card className="flex items-start gap-3 p-4">
                <span
                  aria-hidden
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: upcoming.type.colorHex }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {upcoming.type.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateRange(upcoming.dateFrom, upcoming.dateTo)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pluralise(
                      upcoming.duration,
                      upcoming.type.unit === "HOUR" ? "hour" : "day",
                    )}
                  </p>
                </div>
                <StatusBadge value={upcoming.status} />
              </Card>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
