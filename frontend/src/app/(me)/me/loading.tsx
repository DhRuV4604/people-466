import { Skeleton } from "@/components/ui";

/** Holds the one-column shape while a screen's data arrives. */
export default function MeLoading() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-36 shrink-0 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-13 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </>
  );
}
