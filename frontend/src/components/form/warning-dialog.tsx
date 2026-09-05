"use client";

import * as React from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/overlays";
import { Button, buttonVariants } from "@/components/ui/button";
import type { FormState } from "@/lib/mutate";
import { cn } from "@/lib/utils";

type Warning = NonNullable<FormState["warning"]>;

/** Copies the secret, and says so, because a silent copy is not believed. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      startIcon={copied ? <Check /> : <Copy />}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => undefined,
        );
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * The write worked, but something about it has to be read before it is gone.
 *
 * A modal rather than a toast on purpose: it carries a one-time password that
 * exists nowhere else — not in the database in readable form, not in the
 * outbox — so a message that fades after four seconds would lose it for good.
 * It is dismissed deliberately, once the person has taken what they need.
 */
export function WarningDialog({
  warning,
  onClose,
}: {
  warning: Warning | null;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open={!!warning}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <AlertDialogTitle>{warning?.title}</AlertDialogTitle>
          <AlertDialogDescription>{warning?.body}</AlertDialogDescription>
        </AlertDialogHeader>

        {warning?.secret ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            {warning.secretLabel ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {warning.secretLabel}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-2.5 py-2 font-mono text-sm">
                {warning.secret}
              </code>
              <CopyButton value={warning.secret} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              This is shown once. Closing this box is the last you will see of
              it — sending a new invite is the only way to issue another.
            </p>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "primary", size: "md" }))}
          >
            Done
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
