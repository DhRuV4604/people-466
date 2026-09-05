import {
  FilterSkeleton,
  TableSkeleton,
} from "@/components/data/skeletons";

/** Holds the tab's shape while the API responds, so the strip above it does not jump. */
export default function EmployeePayslipsTabLoading() {
  return (
    <>
      <FilterSkeleton />
      <TableSkeleton rows={6} />
    </>
  );
}
