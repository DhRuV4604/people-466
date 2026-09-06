import { Skeleton } from "@/components/ui";

/**
 * Holds the shape of a screen while its data arrives.
 *
 * Mirrors the real layout: a heading, a row of cards, then the two-column grid
 * from md. The previous version was a single column of fixed-width blocks —
 * three w-36 tiles in a flex row came to 456px, which is wider than a phone,
 * so the skeleton itself pushed the page sideways and every screen appeared
 * shifted and clipped while it loaded.
 */
export default function MeLoading() {
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 md:col-span-2">
          <Skeleton className="h-28 w-full rounded-xl" />
          {/* min-w-0 and a fractional grid, so the row shrinks with the screen
              instead of setting a floor wider than it. */}
          <div className="grid min-w-0 grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-13 w-full rounded-2xl" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}
