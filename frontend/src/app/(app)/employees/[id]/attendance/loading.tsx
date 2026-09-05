import {
  FilterSkeleton,
  TableSkeleton,
} from "@/components/data/skeletons";
import { StatsSkeleton } from "@/components/data/skeletons";

/** Holds the tab's shape while the API responds, so the strip above it does not jump. */
export default function EmployeeAttendanceTabLoading() {
  return (
    <>
      <StatsSkeleton />
      <FilterSkeleton />
      <TableSkeleton rows={6} />
    </>
  );
}
