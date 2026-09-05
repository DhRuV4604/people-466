import { ListSkeleton } from "@/components/data/skeletons";

/**
 * The fallback for every screen in the shell that does not bring its own.
 * Nearly all of them are a filter bar over a list, so that is the shape held
 * while the API answers. A route whose layout differs enough to reflow —
 * employees, with its cards — declares its own instead.
 */
export default function AppLoading() {
  return <ListSkeleton />;
}
