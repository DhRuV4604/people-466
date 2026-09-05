import type { AttendanceDto } from "@peoplepay360/shared";

/**
 * Small date helpers for the self-service space.
 *
 * Everything works in UTC calendar days, because that is how the rest of the
 * app reads attendance: `formatTime` pins UTC, and the form that edits a punch
 * shows UTC. Mixing a local "today" in here would make the same punch belong
 * to two different days on one screen.
 */

/** "2026-09-05" for the given instant, in UTC. */
export function dayKey(at: Date | string): string {
  return new Date(at).toISOString().slice(0, 10);
}

export function today(): string {
  return dayKey(new Date());
}

/** The current month as an inclusive from/to pair the attendance API accepts. */
export function thisMonth(): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return {
    from: dayKey(first),
    to: dayKey(last),
    label: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(first),
  };
}

/**
 * The shift that is still running, if any. The API refuses a second check-in
 * while one is open and closes the newest one on check-out, so this is the
 * same rule it applies: any row without a check-out, newest first.
 */
export function openShift(rows: AttendanceDto[]): AttendanceDto | null {
  return (
    rows
      .filter((row) => row.checkOut === null)
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0] ?? null
  );
}

/** Just the first name, for a greeting. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** "Fri 5 Sept", the way a day reads on a small screen. */
export function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}
