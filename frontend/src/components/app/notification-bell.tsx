"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import type {
  NotificationDto,
  NotificationSummaryDto,
} from "@peoplepay360/shared";

import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useToast,
} from "@/components/ui";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(app)/notifications-actions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** How many the popover holds. The badge still counts every unread one. */
const LIMIT = 12;

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** Each unit and how many of it make the next one up. */
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
];

function relative(iso: string, now: number): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  if (Number.isNaN(seconds)) return "";
  // "43 seconds ago" is noise at this size, and it would be wrong a second
  // later. Under a minute is "just now"; after that the units take over.
  if (Math.abs(seconds) < 60) return "just now";

  let value = seconds;
  for (const [unit, span] of STEPS) {
    if (Math.abs(value) < span) return RELATIVE.format(Math.round(value), unit);
    value /= span;
  }
  return RELATIVE.format(Math.round(value), "year");
}

function parse(data: string): NotificationDto | null {
  try {
    const value = JSON.parse(data) as NotificationDto;
    return value && typeof value.id === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * The header bell: an unread count, a list of what happened, and a live
 * connection so an approval landing in another tab shows up here without a
 * reload.
 */
export function NotificationBell({
  /** First page, loaded on the server, so the count is right in the first paint. */
  initial,
}: {
  initial: NotificationSummaryDto;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = React.useTransition();

  const [open, setOpen] = React.useState(false);
  // The list and the count are one piece of state, so a new arrival can be
  // deduplicated and counted in the same update. Kept apart they would need a
  // ref of seen ids, which cannot be read during render.
  //
  // The server counts every unread notification while the popover holds only
  // the first page, so the badge is not derivable from the list.
  const [{ items, unread }, setFeed] = React.useState(initial);

  // A write revalidates the layout, which re-renders the server component that
  // seeds this one. Taking the new seed is what keeps the optimistic state
  // honest: whatever the browser guessed, the API's answer replaces it.
  //
  // Adjusted during render rather than in an effect, the way FilterBar syncs
  // its search box: an effect would paint the stale list first and then
  // replace it, and the React Compiler rules reject it besides.
  const [seed, setSeed] = React.useState(initial);
  if (seed !== initial) {
    setSeed(initial);
    setFeed(initial);
  }

  React.useEffect(() => {
    const source = new EventSource("/api/notifications/stream");

    const receive = (event: MessageEvent<string>) => {
      const arrival = parse(event.data);
      if (!arrival) return;

      // The seed and the stream can both carry the same notification when one
      // lands while the page is still loading, so it is counted only if the
      // list does not already hold it.
      setFeed((current) => {
        if (current.items.some((item) => item.id === arrival.id)) return current;
        return {
          items: [arrival, ...current.items].slice(0, LIMIT),
          unread: arrival.readAt ? current.unread : current.unread + 1,
        };
      });
    };

    // EventSource reconnects by itself on the interval the server sends, so
    // there is deliberately no reconnect loop here: one would race the
    // browser's and leave two streams open. A refused handshake is different —
    // the spec closes the connection for good rather than retrying — and the
    // bell simply falls back to what the server seeded it with.
    source.addEventListener("message", receive);
    source.addEventListener("notification", receive);

    return () => source.close();
  }, []);

  /**
   * Relative time needs a "now", and the server's is not the browser's: by the
   * time the HTML arrives, "2 minutes ago" has moved on. Rendering it on the
   * server would mismatch on hydration, so `now` starts null and only the
   * client fills it in — until then a row shows its fixed date, which both
   * sides agree on. The interval also keeps the list honest while it is open.
   */
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    // The current time is browser state the server cannot know, so after mount
    // is the earliest it can be read. Rendering it any sooner is the hydration
    // mismatch this whole arrangement exists to avoid.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const report = React.useCallback(
    (run: () => Promise<{ ok?: boolean; error?: string }>) => {
      startTransition(async () => {
        const state = await run();
        if (state.ok) return; // Success is already on screen.

        toast(state.error ?? "That didn't work.", "error");
        // The optimistic count is now a lie, and only a failed write skips the
        // revalidation that would have corrected it, so ask for the truth.
        router.refresh();
      });
    },
    [router, toast],
  );

  const openNotification = (item: NotificationDto) => {
    if (!item.readAt) {
      const readAt = new Date().toISOString();
      setFeed((current) => ({
        items: current.items.map((row) =>
          row.id === item.id ? { ...row, readAt } : row,
        ),
        unread: Math.max(0, current.unread - 1),
      }));
      report(() => markNotificationRead(item.id));
    }

    // Only close where there is somewhere to go. A notification with no link
    // has just been marked read in place, and shutting the list on the user
    // would hide that it happened.
    if (item.href) {
      setOpen(false);
      router.push(item.href);
    }
  };

  const markAll = () => {
    const readAt = new Date().toISOString();
    setFeed((current) => ({
      items: current.items.map((row) => (row.readAt ? row : { ...row, readAt })),
      unread: 0,
    }));
    report(markAllNotificationsRead);
  };

  return (
    // flex-1 rather than ml-auto: it swallows the free space in the header, so
    // the theme toggle beside it stays flush right instead of the two auto
    // margins splitting the gap between them.
    <div className="flex min-w-0 flex-1 justify-end">
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <IconButton
              // Sized to sit beside the theme toggle rather than tower over it.
              size="sm"
              icon={<Bell />}
              // The count is painted beside the button rather than in it, so
              // the accessible name is the only place a screen reader can hear it.
              label={
                unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
              }
            />
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-80 overflow-hidden p-0 sm:w-96"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <p className="text-sm font-medium">Notifications</p>
              {unread > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  startIcon={<CheckCheck />}
                  onClick={markAll}
                >
                  Mark all as read
                </Button>
              ) : null}
            </div>

            {items.length === 0 ? (
              // The shared EmptyState is sized for a page and would dwarf a
              // popover, so this is the same idea at the size of this surface.
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <BellOff className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">You are all caught up</p>
                <p className="text-xs text-muted-foreground">
                  Approvals, pay runs and anything else needing you will appear
                  here.
                </p>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(item)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                        !item.readAt && "bg-primary/[0.04]",
                      )}
                    >
                      <span className="flex items-start gap-2">
                        {/* Unread is carried by a dot as well as the weight,
                            so it does not rest on colour alone. */}
                        <span
                          aria-hidden
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            item.readAt ? "bg-transparent" : "bg-primary",
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 text-sm",
                            item.readAt ? "font-normal" : "font-medium",
                          )}
                        >
                          {item.title}
                        </span>
                      </span>

                      {item.body ? (
                        <span className="pl-3.5 text-xs leading-relaxed text-muted-foreground">
                          {item.body}
                        </span>
                      ) : null}

                      <span className="pl-3.5 text-xs text-muted-foreground">
                        {item.actorName ? `${item.actorName} · ` : ""}
                        <time
                          dateTime={item.createdAt}
                          title={formatDate(item.createdAt)}
                        >
                          {now === null
                            ? formatDate(item.createdAt)
                            : relative(item.createdAt, now)}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>

        {unread > 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}

        {/* The badge changes on its own when something arrives, and a silent
            change is invisible to a screen reader. This says it out loud —
            without role="status", which the toast layer already holds: two of
            them is one live region more than the page means to have. */}
        <span aria-live="polite" aria-atomic className="sr-only">
          {unread > 0 ? `${unread} unread notifications` : ""}
        </span>
      </div>
    </div>
  );
}
