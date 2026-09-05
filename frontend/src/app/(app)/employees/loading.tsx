import { Skeleton } from "@/components/ui";

/** Holds the shape of the page while the API responds, so nothing reflows. */
export default function EmployeesLoading() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
          <Skeleton className="h-11 w-52 rounded-xl" />
          <Skeleton className="h-11 w-40 rounded-xl" />
          <Skeleton className="h-11 w-40 rounded-xl" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-28 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-4 rounded-xl border border-border p-5"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="size-14 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
