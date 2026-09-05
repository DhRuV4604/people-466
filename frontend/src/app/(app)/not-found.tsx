import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { buttonVariants } from "@/components/ui";

/**
 * A record that is not there. Reached either from a stale link or from a
 * record someone else has since removed, so it points back at a list rather
 * than leaving the user on a dead end.
 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <FileQuestion className="size-6" />
      </span>

      <div className="max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">
          That record is not here
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          It may have been removed since the link was made, or the address may
          be wrong.
        </p>
      </div>

      <Link href="/employees" className={buttonVariants({ variant: "outline" })}>
        Back to employees
      </Link>
    </div>
  );
}
