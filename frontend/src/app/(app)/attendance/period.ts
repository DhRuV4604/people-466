/**
 * The window the attendance list is showing.
 *
 * The URL carries one period key rather than a from/to pair so a link keeps
 * its meaning. `/attendance?period=this-month` sent to a colleague still shows
 * the month they open it in, where `?from=2026-09-01&to=2026-09-30` would
 * quietly become last month's numbers, and a bookmark would rot. The dates are
 * derived per request and never stored.
 */

export type Period = {
  /** Human name of the window, for the tiles and the empty state. */
  label: string;
  /** Inclusive calendar days, which is the shape the API's from/to take. */
  from: string;
  to: string;
};

/**
 * What the period select offers beyond the default. "This month" is the
 * select's own placeholder entry, which clears the key, so listing it again
 * here would put the same window in one dropdown twice.
 */
export const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "last-month", label: "Last month" },
  { value: "last-7", label: "Last 7 days" },
  { value: "last-30", label: "Last 30 days" },
  { value: "this-year", label: "This year" },
];

/** A calendar day as the API reads it, "2026-09-01". */
function day(year: number, month: number, date: number): string {
  return new Date(Date.UTC(year, month, date)).toISOString().slice(0, 10);
}

/**
 * Turns the URL's period into the from/to the API takes.
 *
 * Built in UTC because every instant on this screen is printed in UTC
 * (`formatTime` pins it): a window cut in the server's own zone would drop a
 * punch into a different day than the one shown beside it.
 */
export function attendancePeriod(
  value: string | undefined,
  now: Date = new Date(),
): Period {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  switch (value) {
    case "last-month":
      // Day 0 of a month is the last day of the month before it.
      return {
        label: "Last month",
        from: day(year, month - 1, 1),
        to: day(year, month, 0),
      };
    case "last-7":
      return {
        label: "Last 7 days",
        from: day(year, month, date - 6),
        to: day(year, month, date),
      };
    case "last-30":
      return {
        label: "Last 30 days",
        from: day(year, month, date - 29),
        to: day(year, month, date),
      };
    case "this-year":
      return {
        label: "This year",
        from: day(year, 0, 1),
        to: day(year, 11, 31),
      };
    default:
      // An unrecognised period, and "this-month" written out in full, both land
      // on the default window rather than on an empty or an all-time list.
      return {
        label: "This month",
        from: day(year, month, 1),
        to: day(year, month + 1, 0),
      };
  }
}
