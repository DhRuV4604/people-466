"use client";

import * as React from "react";
import { LogIn, LogOut } from "lucide-react";

import { Button, Card, useToast } from "@/components/ui";
import type { FormState } from "@/lib/mutate";
import { formatTime, hours } from "@/lib/format";
import { cn } from "@/lib/utils";

import { punchIn, punchOut } from "../actions";

type Props = {
  /** The shift still running, if there is one. */
  open: { checkIn: string } | null;
  /** Hours already closed out today, shown once the day is done. */
  workedToday: number;
};

/** "2h 14m" from a start time and now. */
function elapsed(from: string, now: number): string {
  const ms = Math.max(0, now - new Date(from).getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The one control an employee uses every day, so it gets the room: the state
 * in words, the time it has been running, and a button large enough to hit
 * without looking. Which button shows is decided by the same rule the API
 * applies — a shift without a check-out is open — so the two never disagree.
 */
export function PunchCard({ open, workedToday }: Props) {
  const [pending, startTransition] = React.useTransition();
  const { toast } = useToast();

  // "Now" is browser state the server cannot know, so the running total only
  // appears after mount. Until then the card shows the check-in time, which
  // both sides agree on, and nothing mismatches on hydration.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const run = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const state = await action();
      if (state.ok) toast(state.message ?? "Done.");
      else toast(state.error ?? "That didn't work.", "error");
    });

  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          "flex flex-col gap-5 p-5",
          open && "bg-gradient-to-br from-primary/10 via-transparent to-transparent",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Today
            </p>
            {open ? (
              <>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {now ? elapsed(open.checkIn, now) : formatTime(open.checkIn)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Checked in at {formatTime(open.checkIn)} UTC
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {workedToday > 0 ? hours(workedToday) : "Not checked in"}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {workedToday > 0
                    ? "Worked so far today"
                    : "Tap below when you start"}
                </p>
              </>
            )}
          </div>
          <span
            aria-hidden
            className={cn(
              "mt-1 size-2.5 shrink-0 rounded-full",
              open ? "bg-primary shadow-[0_0_0_4px] shadow-primary/20" : "bg-border",
            )}
          />
        </div>

        {open ? (
          <Button
            size="lg"
            variant="outline"
            fullWidth
            className="h-14 rounded-2xl text-base"
            startIcon={<LogOut />}
            loading={pending}
            loadingText="Checking out"
            onClick={() => run(punchOut)}
          >
            Check out
          </Button>
        ) : (
          <Button
            size="lg"
            fullWidth
            className="h-14 rounded-2xl text-base"
            startIcon={<LogIn />}
            loading={pending}
            loadingText="Checking in"
            onClick={() => run(punchIn)}
          >
            Check in
          </Button>
        )}
      </div>
    </Card>
  );
}
