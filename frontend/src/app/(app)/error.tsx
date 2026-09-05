"use client";

import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui";

/**
 * What the user sees when a screen throws: most often the API being
 * unreachable, which is an expected condition rather than a bug in the page.
 *
 * It says what failed and offers the one thing that can help, because a stack
 * trace tells someone using the product nothing they can act on. The message
 * is still shown, in small print, so it can be quoted to whoever can fix it.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Nothing collects errors yet, so at least leave a trace in the console
    // rather than swallowing it entirely.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>

      <div className="max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">
          This screen could not load
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Nothing has been changed or lost. It is usually the connection to the
          API rather than anything you did, so trying again often works.
        </p>
      </div>

      <Button startIcon={<RotateCw />} onClick={reset}>
        Try again
      </Button>

      <p className="max-w-md font-mono text-xs break-words text-muted-foreground/70">
        {error.message}
        {error.digest ? ` · ${error.digest}` : null}
      </p>
    </div>
  );
}
