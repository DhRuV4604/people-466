import { Skeleton } from "@/components/ui";

/**
 * Placeholders that hold the shape of what is arriving, so a page does not
 * reflow when the data lands. They mirror the real layouts rather than
 * standing in as generic grey blocks, which is the difference between a
 * placeholder and a distraction.
 */

/** The filter bar every list carries: search, a few selects, the count chips. */
export function FilterSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
        <Skeleton className="h-11 w-44 rounded-xl" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-24 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: tiles }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl border border-border p-5"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border p-4 last:border-0"
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-40 max-w-full" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="hidden h-3 w-24 md:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** A filtered list: the shape almost every screen in the app has. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      <FilterSkeleton />
      <TableSkeleton rows={rows} />
    </>
  );
}
