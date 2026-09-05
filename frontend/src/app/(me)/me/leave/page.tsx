import type { Metadata } from "next";
import { CalendarOff } from "lucide-react";
import type {
  LeaveBalanceDto,
  LeaveRequestDto,
  TimeOffTypeDto,
} from "@peoplepay360/shared";

import { EmptyState } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { ActionButton, RecordDialog } from "@/components/form";
import { Button, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireMe } from "@/lib/access";
import { dateRange, formatDate, pluralise } from "@/lib/format";

import { LeaveBalances } from "@/app/(app)/time-off/_components/leave-balances";
import { requestLeave, withdrawLeave } from "../actions";
import { leaveFields } from "../fields";
import { dayKey, today } from "../_lib";

export const metadata: Metadata = { title: "Leave" };

async function soft<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return fallback;
    throw error;
  }
}

/** A request the person can still pull back: undecided, or approved but not yet begun. */
function withdrawable(r: LeaveRequestDto): boolean {
  return (
    r.status === "TO_APPROVE" ||
    (r.status === "APPROVED" && dayKey(r.dateFrom) > today())
  );
}

function RequestRow({ request }: { request: LeaveRequestDto }) {
  const unit = request.type.unit === "HOUR" ? "hour" : "day";
  return (
    <li className="flex items-center gap-3 p-4">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: request.type.colorHex }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{request.type.name}</p>
        <p className="text-xs text-muted-foreground">
          {dateRange(request.dateFrom, request.dateTo)} ·{" "}
          {pluralise(request.duration, unit)}
        </p>
        {request.status === "REFUSED" && request.refuseReason ? (
          <p className="mt-1 text-xs text-destructive">{request.refuseReason}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge value={request.status} />
        {withdrawable(request) ? (
          <ActionButton
            action={withdrawLeave.bind(null, request.id)}
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            confirm={{
              title: "Withdraw this request?",
              description: `${request.type.name}, ${dateRange(request.dateFrom, request.dateTo)}. Your manager will be told it no longer stands.`,
              confirmLabel: "Withdraw",
              destructive: true,
            }}
          >
            Withdraw
          </ActionButton>
        ) : null}
      </div>
    </li>
  );
}

export default async function MeLeave() {
  const user = await requireMe();

  const [balances, requests, types] = await Promise.all([
    soft(apiFetch<LeaveBalanceDto[]>(`/time-off/balances/${user.employeeId}`), []),
    soft(
      apiFetch<LeaveRequestDto[]>("/time-off/requests", {
        query: { employeeId: user.employeeId, limit: 100 },
      }),
      [],
    ),
    soft(apiFetch<TimeOffTypeDto[]>("/time-off/types"), []),
  ]);

  const byDate = [...requests].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
  const waiting = byDate.filter((r) => r.status === "TO_APPROVE");
  const upcoming = byDate
    .filter((r) => r.status === "APPROVED" && dayKey(r.dateTo) >= today())
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  const past = byDate.filter(
    (r) => !waiting.includes(r) && !upcoming.includes(r),
  );

  const options = types
    .filter((t) => t.active)
    .map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <h1 className="sr-only">Leave</h1>

      <RecordDialog
        title="Request leave"
        description="Your manager is told the moment you send it."
        fields={leaveFields(options)}
        action={requestLeave}
        submitLabel="Send request"
        trigger={
          <Button size="lg" fullWidth className="h-13 rounded-2xl" startIcon={<CalendarOff />}>
            Request leave
          </Button>
        }
      />

      <LeaveBalances
        rows={balances}
        title="Your balances"
        description={`As of ${formatDate(today())}.`}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="No leave yet"
          description="Anything you request shows up here with where it has got to."
        />
      ) : (
        <>
          {waiting.length > 0 ? (
            <Group title="Awaiting approval" rows={waiting} />
          ) : null}
          {upcoming.length > 0 ? <Group title="Coming up" rows={upcoming} /> : null}
          {past.length > 0 ? <Group title="Earlier" rows={past} /> : null}
        </>
      )}
    </>
  );
}

function Group({ title, rows }: { title: string; rows: LeaveRequestDto[] }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h2>
      <Card>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))}
        </ul>
      </Card>
    </section>
  );
}
