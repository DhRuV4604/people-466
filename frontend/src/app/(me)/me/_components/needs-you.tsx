import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  Upload,
} from "lucide-react";
import type { DocumentDto, LeaveRequestDto } from "@peoplepay360/shared";

import { Card } from "@/components/ui";
import { dateRange, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** What they have to do, in the imperative. */
  action: string;
  title: string;
  detail: string;
  /** True where nothing happens until they act. */
  urgent: boolean;
};

/**
 * Everything waiting on the person, before anything describing them.
 *
 * This is the first thing on the screen because it is the only part that goes
 * stale: a leave balance is the same tomorrow, a contract nobody signed is not.
 * Documents lead it — they are the item most often waiting and the one with no
 * other prompt anywhere in the space.
 */
export function NeedsYou({
  documents,
  pending,
}: {
  documents: DocumentDto[];
  pending: LeaveRequestDto[];
}) {
  const items: Item[] = [];

  for (const document of documents) {
    if (document.status === "AWAITING_SIGNATURE") {
      items.push({
        key: document.id,
        href: `/me/documents/${document.id}`,
        icon: FileSignature,
        action: "Sign it",
        title: document.title,
        detail: document.sentAt
          ? `Sent ${formatDate(document.sentAt)}`
          : "Waiting for your signature",
        urgent: true,
      });
    } else if (document.status === "REQUESTED") {
      items.push({
        key: document.id,
        href: `/me/documents/${document.id}`,
        icon: Upload,
        action: "Upload it",
        title: document.title,
        detail: `${document.createdBy.name} asked for this`,
        urgent: true,
      });
    }
  }

  for (const request of pending) {
    items.push({
      key: request.id,
      href: "/me/leave",
      icon: CheckCircle2,
      action: "Waiting",
      title: `${request.type.name} awaiting approval`,
      detail: dateRange(request.dateFrom, request.dateTo),
      // Nothing for them to do — it is with their manager. Shown so they are
      // not left wondering, but not dressed up as a task.
      urgent: false,
    });
  }

  if (items.length === 0) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CheckCircle2 className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Nothing needs you</p>
          <p className="text-xs text-muted-foreground">
            No documents to sign and no requests outstanding.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <section aria-labelledby="needs-you" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="needs-you" className="text-sm font-medium">
          Needs you
          <span className="ml-2 font-normal text-muted-foreground">
            {items.filter((item) => item.urgent).length > 0
              ? `${items.filter((item) => item.urgent).length} to do`
              : "nothing to do"}
          </span>
        </h2>
        <Link
          href="/me/documents"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          All documents <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* auto-fit rather than a fixed column count: two outstanding items in a
          three-column grid left a third of the row empty and the whole thing
          looked broken. This way whatever there is spreads to fill the width,
          and a long list wraps.

          min-w-0 on the item, because a grid track is `auto` by default and a
          card wider than its column pushes the page sideways instead of
          shrinking into it. */}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3">
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            <Link
              href={item.href}
              className={cn(
                "group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl",
                "border border-border bg-card p-3.5",
                "transition-all outline-none hover:-translate-y-0.5 hover:shadow-lg",
                "focus-visible:ring-[3px] focus-visible:ring-ring",
              )}
            >
              {/* A hairline of the tone across the top, as on the dashboard,
                  so what is waiting reads before the words do. */}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 top-0 h-0.5",
                  item.urgent ? "bg-primary" : "bg-border",
                )}
              />

              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl",
                  item.urgent
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <item.icon className="size-4" />
              </span>

              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.detail}
                </span>
              </span>

              <span
                className={cn(
                  "mt-auto inline-flex items-center gap-1 text-xs font-medium",
                  item.urgent ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.action}
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
