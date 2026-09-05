"use client";

import type * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarOff,
  Clock3,
  FileSignature,
  House,
  UserRound,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** A grant this destination depends on. Absent means everyone gets it. */
  needs?: "pay";
};

const ITEMS: Item[] = [
  { href: "/me", label: "Home", icon: House },
  { href: "/me/leave", label: "Leave", icon: CalendarOff },
  { href: "/me/attendance", label: "Time", icon: Clock3 },
  { href: "/me/pay", label: "Pay", icon: Wallet, needs: "pay" },
  { href: "/me/documents", label: "Docs", icon: FileSignature },
  { href: "/me/profile", label: "Me", icon: UserRound },
];

/**
 * The same destinations, in two shapes: a thumb-reachable bar fixed to the
 * bottom on a phone, and a row of pills in the header where there is room. Both
 * render from one list so the space can never offer different places to go
 * depending on the screen it is opened on.
 */
export function MeNav({
  variant,
  /**
   * Whether this role may read payslips at all. An HR manager has none, and a
   * tab that only ever bounces them back is worse than no tab.
   */
  showPay,
}: {
  variant: "bottom" | "top";
  showPay: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/me" ? pathname === "/me" : pathname.startsWith(href);

  const items = ITEMS.filter((item) => showPay || item.needs !== "pay");

  if (variant === "top") {
    return (
      <nav aria-label="Sections" className="flex items-center gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    // env(safe-area-inset-bottom) keeps the bar clear of a phone's home
    // indicator, which would otherwise sit on top of the labels.
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul
        className="mx-auto grid max-w-2xl"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // 56px tall: comfortably above the 44px minimum a thumb needs.
                  "relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none transition-colors focus-visible:bg-muted",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.25]")} />
                {label}
                {active ? (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
