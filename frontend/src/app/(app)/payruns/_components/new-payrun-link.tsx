import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui";

/**
 * Creating a run is a page rather than a dialog, so the control that starts it
 * is a link wearing the button's clothes.
 */
export function NewPayrunLink() {
  return (
    <Link href="/payruns/new" className={buttonVariants({ size: "sm" })}>
      <Plus />
      New pay run
    </Link>
  );
}
