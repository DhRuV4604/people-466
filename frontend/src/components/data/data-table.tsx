import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Column<T> = {
  /** Column heading. Leave empty for an unlabelled column such as an avatar. */
  header?: string;
  cell: (row: T) => React.ReactNode;
  /** Tailwind width or alignment for both the heading and the cells. */
  className?: string;
  /** Hide this column below the given breakpoint, so narrow screens stay readable. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  align?: "left" | "right";
};

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

/**
 * One table for every list screen. Columns are declared per page, everything
 * else, borders, spacing, hover, row links and responsive hiding, is shared, so
 * two lists in different modules cannot drift apart.
 */
export function DataTable<T>({
  rows,
  columns,
  getKey,
  href,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  /** When given, the whole row navigates and a chevron is added. */
  href?: (row: T) => string;
  className?: string;
}) {
  const all: Column<T>[] = href
    ? [
        ...columns,
        {
          className: "w-10",
          align: "right",
          cell: () => (
            <ChevronRight className="size-4 text-muted-foreground/50" />
          ),
        },
      ]
    : columns;

  return (
    <div
      className={cn(
        "w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-card",
        className,
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {all.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={cn(
                  "px-3 py-3 text-left text-xs font-medium whitespace-nowrap text-muted-foreground sm:px-4",
                  column.align === "right" && "text-right",
                  column.hideBelow && HIDE[column.hideBelow],
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getKey(row)}
              className="border-b border-border last:border-0 hover:bg-muted/40 has-[a:focus-visible]:bg-muted/40"
            >
              {all.map((column, index) => {
                const content = column.cell(row);
                return (
                  <td
                    key={index}
                    className={cn(
                      "px-3 py-3 align-middle sm:px-4",
                      column.align === "right" && "text-right",
                      column.hideBelow && HIDE[column.hideBelow],
                      column.className,
                    )}
                  >
                    {/* Only the first cell is the link. Stretching a link
                        across a table row is unreliable, so the hover state
                        and the chevron carry the affordance instead. */}
                    {href && index === 0 ? (
                      <Link
                        href={href(row)}
                        className="block rounded outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
