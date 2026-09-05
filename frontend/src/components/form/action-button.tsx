"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/mutate";

/**
 * A server action that redirects rejects its promise instead of resolving, and
 * the router needs that rejection to navigate. Anything else is a real failure.
 */
function isRedirect(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export type ActionButtonProps = Omit<ButtonProps, "onClick" | "loading"> & {
  /** The server action to run. Takes nothing; the caller closes over its ids. */
  action: () => Promise<FormState>;
  children: React.ReactNode;
  /** Ask first. Required for anything destructive or hard to undo. */
  confirm?: {
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
  };
  /** Shown while the action runs. */
  pendingLabel?: string;
};

/**
 * A button wired to a server action: it disables itself while the request is
 * in flight, confirms first when asked to, and reports the outcome as a toast
 * so a change that only moves a badge is still acknowledged.
 */
export function ActionButton({
  action,
  children,
  confirm,
  pendingLabel,
  ...props
}: ActionButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const run = React.useCallback(() => {
    startTransition(async () => {
      try {
        const state = await action();
        if (state.ok) toast(state.message ?? "Done.");
        else toast(state.error ?? "That didn't work.", "error");
      } catch (error) {
        if (isRedirect(error)) throw error;
        toast("That didn't work. Try again.", "error");
      }
    });
  }, [action, toast]);

  const button = (
    <Button {...props} loading={pending} loadingText={pendingLabel}>
      {children}
    </Button>
  );

  if (!confirm) {
    return React.cloneElement(button, { onClick: run });
  }

  return (
    <ConfirmDialog
      trigger={button}
      title={confirm.title}
      description={confirm.description}
      confirmLabel={confirm.confirmLabel ?? "Confirm"}
      destructive={confirm.destructive}
      onConfirm={run}
    />
  );
}
