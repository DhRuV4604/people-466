"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { FieldSpec } from "@/lib/fields";
import type { FormState } from "@/lib/mutate";
import { RecordForm } from "./record-form";
import { WarningDialog } from "./warning-dialog";

export type RecordDialogProps = {
  title: string;
  description?: string;
  fields: FieldSpec[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Present for an edit, absent for a create. */
  record?: object;
  submitLabel?: string;
  /** Controls the field list cannot express. See `RecordForm`. */
  extras?: React.ReactNode;
  /** Defaults to a primary "New …" button built from the title. */
  trigger?: React.ReactNode;
  /** For a dialog opened from a menu, which owns its own open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Create and edit are the same dialog: the record decides which. It closes on
 * success and confirms with a toast, and stays open with the messages in place
 * when the API rejects the write.
 */
export function RecordDialog({
  title,
  description,
  fields,
  action,
  record,
  submitLabel,
  extras,
  trigger,
  open,
  onOpenChange,
}: RecordDialogProps) {
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const { toast } = useToast();

  const isOpen = open ?? uncontrolled;
  const setOpen = React.useCallback(
    (next: boolean) => {
      setUncontrolled(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const [warning, setWarning] = React.useState<FormState["warning"]>();

  const handleDone = React.useCallback(
    (state: FormState) => {
      setOpen(false);
      // A warning replaces the toast rather than joining it: two notices for
      // one write, one of them disappearing, is how the important half gets
      // missed.
      if (state.warning) setWarning(state.warning);
      else if (state.message) toast(state.message);
    },
    [setOpen, toast],
  );

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setOpen}>
        {open === undefined ? (
          <DialogTrigger asChild>
            {trigger ?? (
              // md, not sm: this sits in a filter bar next to the search box
              // and the selects, and those are 44px tall.
              <Button startIcon={<Plus />} size="md">
                {title}
              </Button>
            )}
          </DialogTrigger>
        ) : null}
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>

          <RecordForm
            // Remounting per open discards whatever the last attempt left
            // behind, so a form always starts from the record as it is now.
            key={isOpen ? "open" : "closed"}
            fields={fields}
            action={action}
            defaults={record}
            submitLabel={submitLabel}
            extras={extras}
            onDone={handleDone}
            onCancel={close}
          />
        </DialogContent>
      </Dialog>

      <WarningDialog
        warning={warning ?? null}
        onClose={() => setWarning(undefined)}
      />
    </>
  );
}
