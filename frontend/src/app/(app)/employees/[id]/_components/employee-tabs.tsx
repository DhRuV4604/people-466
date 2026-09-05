"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type EmployeeTab = { href: string; label: string; count?: number };

/**
 * The record's own navigation.
 *
 * Each tab is a real route rather than client state, so a tab can be linked
 * and the back button behaves, and opening the record loads one module's rows
 * instead of all five. Which tabs exist is decided on the server from the
 * viewer's role; this only marks which one is current.
 */
export function EmployeeTabs({
  base,
  tabs,
}: {
  base: string;
  tabs: EmployeeTab[];
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Employee record"
      // A narrow screen scrolls the strip sideways rather than wrapping it
      // onto a second row that pushes the content down the page.
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1"
    >
      {tabs.map((tab) => {
        // The overview is the base path, so a prefix test would match it on
        // every tab. It alone is compared exactly.
        const current =
          tab.href === base ? pathname === base : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring",
              current
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
