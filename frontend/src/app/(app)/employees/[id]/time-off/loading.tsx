import { SectionSkeleton } from "@/components/data/skeletons";

/** Two lists share this tab, so the placeholder holds both. */
export default function EmployeeTimeOffTabLoading() {
  return (
    <>
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={3} />
    </>
  );
}
