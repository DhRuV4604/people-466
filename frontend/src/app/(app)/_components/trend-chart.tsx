import { moneyShort } from "@/lib/format";
import { cn } from "@/lib/utils";

type Month = { month: string; netSalary: number; payslips: number };

/**
 * Twelve months of payroll, as bars.
 *
 * This was a twelve-row table, eleven rows of which read "0" and "Rs. 0.00" on
 * any install that has not been running a year. A table asks you to read every
 * row to find the shape; bars are the shape. The exact figure is still there on
 * the month you point at.
 *
 * Plain divs rather than a charting library: it is one series of twelve values,
 * and a library would be a hundred kilobytes to draw a dozen rectangles.
 */
export function TrendChart({ months }: { months: Month[] }) {
  const peak = Math.max(...months.map((m) => m.netSalary), 1);
  const paid = months.filter((m) => m.payslips > 0);
  const busiest = paid.reduce<Month | null>(
    (best, m) => (!best || m.netSalary > best.netSalary ? m : best),
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-1.5 sm:gap-2">
        {months.map((month) => {
          const share = (month.netSalary / peak) * 100;
          const empty = month.payslips === 0;

          return (
            <div
              key={month.month}
              className="group/bar relative flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              {/* The tooltip is a sibling rather than a title attribute so it
                  appears immediately; a native tooltip waits a second, which is
                  long enough to give up on. */}
              <span
                className={cn(
                  "pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-lg border border-border",
                  "bg-popover px-2 py-1 text-center text-xs whitespace-nowrap opacity-0 shadow-md",
                  "transition-opacity group-hover/bar:opacity-100",
                )}
              >
                <span className="block font-medium">
                  {moneyShort(month.netSalary)}
                </span>
                <span className="block text-muted-foreground">
                  {month.payslips} payslips
                </span>
              </span>

              <div className="flex h-28 w-full items-end">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-colors",
                    empty
                      ? "bg-muted"
                      : "bg-primary/70 group-hover/bar:bg-primary",
                  )}
                  // A month with payroll always shows something, so a lean
                  // month is not mistaken for a month that never ran.
                  style={{ height: empty ? 3 : `${Math.max(share, 4)}%` }}
                />
              </div>

              <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                {month.month.split(" ")[0]}
              </span>
            </div>
          );
        })}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Paid this year</dt>
          <dd className="font-medium tabular-nums">
            {moneyShort(months.reduce((sum, m) => sum + m.netSalary, 0))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Months run</dt>
          <dd className="font-medium tabular-nums">
            {paid.length} of {months.length}
          </dd>
        </div>
        {busiest ? (
          <div>
            <dt className="text-xs text-muted-foreground">Biggest month</dt>
            <dd className="font-medium">
              {busiest.month} · {moneyShort(busiest.netSalary)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
