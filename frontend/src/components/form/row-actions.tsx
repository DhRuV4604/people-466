"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { FieldSpec } from "@/lib/fields";
import type { FormState } from "@/lib/mutate";
import { RecordDialog } from "./record-dialog";

/**
 * A server action that redirects rejects its promise instead of resolving, and
 * the router needs that rejection to navigate. Anything else is a real failure.
 */
function isRedirect(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export type RowActionsProps = {
  /** Opens the edit dialog. Omit for a row that cannot be edited. */
  edit?: {
    title: string;
    description?: string;
    fields: FieldSpec[];
    action: (state: FormState, formData: FormData) => Promise<FormState>;
    record: object;
    /** A control the field list cannot express. See `RecordForm`. */
    extras?: React.ReactNode;
  };
  /** Deletes the row after confirming. */
  remove?: {
    action: () => Promise<FormState>;
    title: string;
    description: string;
  };
  /** Anything else this row can do, above the edit and delete entries. */
  items?: {
    label: string;
    icon?: React.ReactNode;
    action: () => Promise<FormState>;
    destructive?: boolean;
    /** Ask first. Required for anything irreversible. */
    confirm?: {
      title: string;
      description: string;
      confirmLabel?: string;
      destructive?: boolean;
    };
  }[];
};

type RowItem = NonNullable<RowActionsProps["items"]>[number];

/**
 * The per-row menu. Every list uses it, so edit and delete sit in the same
 * place on every screen and a row only differs by the verbs above them.
 */
export function RowActions({ edit, remove, items = [] }: RowActionsProps) {
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [, startTransition] = React.useTransition();
  const { toast } = useToast();

  const [pendingConfirm, setPendingConfirm] = React.useState<RowItem | null>(
    null,
  );

  const run = React.useCallback(
    (action: () => Promise<FormState>) => {
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
    },
    [toast],
  );

  if (!edit && !remove && items.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            icon={<MoreHorizontal />}
            label="Row actions"
            size="sm"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              variant={item.destructive ? "destructive" : "default"}
              onSelect={() =>
                item.confirm ? setPendingConfirm(item) : run(item.action)
              }
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}

          {edit ? (
            <>
              {items.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
            </>
          ) : null}

          {remove ? (
            <>
              {edit || items.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirming(true)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {edit ? (
        <RecordDialog
          title={edit.title}
          description={edit.description}
          fields={edit.fields}
          action={edit.action}
          record={edit.record}
          extras={edit.extras}
          open={editing}
          onOpenChange={setEditing}
        />
      ) : null}

      {pendingConfirm?.confirm ? (
        <ConfirmDialog
          key={pendingConfirm.label}
          defaultOpen
          onOpenChange={(next) => {
            if (!next) setPendingConfirm(null);
          }}
          title={pendingConfirm.confirm.title}
          description={pendingConfirm.confirm.description}
          confirmLabel={pendingConfirm.confirm.confirmLabel ?? "Confirm"}
          destructive={pendingConfirm.confirm.destructive}
          onConfirm={() => run(pendingConfirm.action)}
        />
      ) : null}

      {remove && confirming ? (
        <ConfirmDialog
          key="confirm-delete"
          defaultOpen
          onOpenChange={setConfirming}
          title={remove.title}
          description={remove.description}
          confirmLabel="Delete"
          destructive
          onConfirm={() => run(remove.action)}
        />
      ) : null}
    </>
  );
}
