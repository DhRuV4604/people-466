import { Tags } from "lucide-react";
import type { LeaveBalanceDto, LeaveUnit } from "@peoplepay360/shared";

import { EmptyState, Section } from "@/components/data/primitives";
import { ApiError, apiFetch } from "@/lib/api-client";
import { pluralise } from "@/lib/format";

/**
 * What an employee has left to take, per leave type. The same panel serves the
 * employee looking at their own time off and the HR user looking at someone
 * else's record before approving leave, so the two never disagree.
 */

/**
 * A role that turns out not to be allowed to read allocations gets the page
 * without this panel rather than an error, so the caller renders nothing on
 * null. An empty array is a real answer: no leave types exist.
 */
export async function loadBalances(
  employeeId: string,
): Promise<LeaveBalanceDto[] | null> {
  try {
    return await apiFetch<LeaveBalanceDto[]>(`/time-off/balances/${employeeId}`);
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

/** The thing a type counts in. Every figure on the panel is read in it. */
function unitNoun(unit: LeaveUnit): string {
  return unit === "HOUR" ? "hour" : "day";
}

/** "12 days" or "1 hour", for a figure read inline. */
function inUnit(count: number, unit: LeaveUnit): string {
  return pluralise(count, unitNoun(unit));
}

/** Just the word, for a headline that shows the number at its own size. */
function unitWord(count: number, unit: LeaveUnit): string {
  const noun = unitNoun(unit);
  return count === 1 ? noun : `${noun}s`;
}

function BalanceRow({ row }: { row: LeaveBalanceDto }) {
  // A type that draws from no allocation has no ceiling, so `remaining` is
  // whatever has been taken subtracted from zero and means nothing. What is
  // true of it is how much has been taken, so that is the number shown.
  const capped = row.requiresAllocation;
  const headline = capped ? row.remaining : row.taken;

  const supporting: string[] = capped
    ? row.allocated === 0
      ? ["Nothing allocated yet"]
      : [
          `${inUnit(row.allocated, row.unit)} allocated`,
          `${inUnit(row.taken, row.unit)} taken`,
        ]
    : ["No allocation needed"];

  // `remaining` counts approved leave only, so anything still waiting on a
  // decision has to be called out or the number reads as safely spendable.
  if (row.pending > 0) {
    supporting.push(`${inUnit(row.pending, row.unit)} awaiting approval`);
  }

  return (
    <li className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="flex items-center gap-2.5 text-sm font-medium">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: row.colorHex }}
          />
          <span className="truncate">{row.typeName}</span>
        </p>
        <p className="mt-1 pl-5 text-xs text-muted-foreground">
          {supporting.join(" · ")}
        </p>
      </div>

      {/* The space between the figure and its unit is a real one, so the row
          is read out as "20 days remaining" rather than "20days". Nothing in
          here may wrap, or the unit drops below the number it belongs to. */}
      <p className="shrink-0 whitespace-nowrap text-right">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {headline}
        </span>{" "}
        <span className="text-sm text-muted-foreground">
          {unitWord(headline, row.unit)}
        </span>
        <span className="block text-xs text-muted-foreground">
          {capped ? "remaining" : "taken"}
        </span>
      </p>
    </li>
  );
}

export function LeaveBalances({
  rows,
  title = "Leave balances",
  description = "Approved allocations less approved leave, as things stand today.",
}: {
  rows: LeaveBalanceDto[];
  title?: string;
  description?: string;
}) {
  return (
    <Section title={title} description={description}>
      {rows.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No leave types"
          description="Balances appear here once an active leave type exists to count against."
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <BalanceRow key={row.typeId} row={row} />
          ))}
        </ul>
      )}
    </Section>
  );
}
