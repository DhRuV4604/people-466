"use client";

import * as React from "react";
import { LogOut } from "lucide-react";

import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { LogIn } from "@/components/animate-ui/icons/log-in";
import type { PunchStatusDto } from "@peoplepay360/shared";

import { Button, Card, ConfirmDialog, useToast } from "@/components/ui";
import type { FormState } from "@/lib/mutate";
import { formatTime, hours, pluralise } from "@/lib/format";
import { cn } from "@/lib/utils";

import { punchIn, punchOut } from "../actions";

type Props = {
  /**
   * The shift still running, if there is one.
   *
   * Taken from the punch status rather than derived from a list of punches:
   * the API refuses a second check-in while any shift is open, of any date, and
   * a month-scoped list cannot see one opened last month. The button said
   * "Check in" and the API answered "you already have an open check-in".
   */
  open: { checkIn: string } | null;
  /** Hours already closed out today, shown once the day is done. */
  workedToday: number;
  /** Where the employee stands against the day's cap, from the API. */
  punches: PunchStatusDto;
};

/** "2h 14m" from a start time and now. */
function elapsed(from: string, now: number): string {
  const ms = Math.max(0, now - new Date(from).getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * What checking out costs, in the employee's terms. Closing a shift is the
 * moment the cap bites — the check-in that opened it is already spent, so the
 * question is only whether another one is left afterwards.
 */
function checkOutWarning(punches: PunchStatusDto): string {
  const left = punches.remaining;
  if (left <= 0) {
    return punches.allowed === 1
      ? "This closes your day. You cannot check in again today, so contact HR if you leave and come back."
      : `You have used all ${punches.allowed} check-ins allowed today, so you will not be able to check in again.`;
  }
  return `You will have ${pluralise(left, "check-in")} left today.`;
}

/**
 * The one control an employee uses every day, so it gets the room: the state
 * in words, the time it has been running, and a button large enough to hit
 * without looking. Which button shows is decided by the same rule the API
 * applies — a shift without a check-out is open — so the two never disagree.
 *
 * The day's punches are capped by the attendance policy, so the card says up
 * front when nothing is left rather than letting the tap come back as an
 * error, and confirms before a check-out that cannot be undone by punching
 * back in.
 */
export function PunchCard({ open, workedToday, punches }: Props) {
  const [pending, startTransition] = React.useTransition();
  const { toast } = useToast();
  const [confirming, setConfirming] = React.useState(false);

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

  // Nothing open and nothing left: the day is spent. The API refuses another
  // check-in anyway, so the button says so rather than offering the tap.
  const spent = !open && punches.remaining <= 0;

  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          // Stacked on a phone, where the button is the whole point of the
          // screen. Side by side from sm, where a full-width primary button is
          // several hundred pixels of purple for one click.
          "flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
          // A flat tint rather than a gradient: the wash faded to nothing
          // across the card and read as a rendering artefact more than a state.
          open && "bg-primary/[0.04]",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start justify-between gap-4 sm:justify-start sm:gap-3">
          <div className="min-w-0">
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
                  {spent
                    ? "That is your day recorded"
                    : workedToday > 0
                      ? "Worked so far today"
                      : "Tap below when you start"}
                </p>
              </>
            )}
          </div>
          <span
            aria-hidden
            className={cn(
              "mt-1 size-2.5 shrink-0 rounded-full sm:order-first sm:mt-2.5",
              open ? "bg-primary shadow-[0_0_0_4px] shadow-primary/20" : "bg-border",
            )}
          />
        </div>

        {/* Only worth saying when the policy allows more than one: at a cap of
            one the button state already tells the whole story. */}
        {punches.allowed > 1 && !spent ? (
          <p className="-mt-2 text-xs text-muted-foreground sm:hidden">
            {pluralise(punches.remaining, "check-in")} left today of{" "}
            {punches.allowed}
          </p>
        ) : null}

        {open ? (
          <>
            <Button
              size="lg"
              variant="outline"
              fullWidth
              className="h-14 rounded-2xl text-base sm:h-12 sm:w-44 sm:shrink-0"
              startIcon={<LogOut />}
              loading={pending}
              loadingText="Checking out"
              onClick={() =>
                punches.warnOnCheckOut
                  ? setConfirming(true)
                  : run(punchOut)
              }
            >
              Check out
            </Button>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Check out now?"
              description={`${
                now ? `You have been checked in for ${elapsed(open.checkIn, now)}. ` : ""
              }${checkOutWarning(punches)}`}
              confirmLabel="Check out"
              cancelLabel="Stay checked in"
              onConfirm={() => run(punchOut)}
            />
          </>
        ) : (
          // The arrow walks into the door on hover. This is the button the
          // whole screen exists for, and the one place motion says something
          // rather than decorating.
          <AnimateIcon animateOnHover asChild>
            <Button
              size="lg"
              fullWidth
              className="h-14 rounded-2xl text-base sm:h-12 sm:w-44 sm:shrink-0"
              startIcon={<LogIn />}
              loading={pending}
              loadingText="Checking in"
              disabled={spent}
              onClick={() => run(punchIn)}
            >
              {spent ? "Checked in already today" : "Check in"}
            </Button>
          </AnimateIcon>
        )}

        {spent ? (
          <p className="-mt-2 text-xs text-muted-foreground sm:hidden">
            Your check-ins for today are used up. Ask HR if a correction is
            needed.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
