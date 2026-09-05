"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * One form row = `Field` > `FieldLabel` + control + `FieldError`.
 * Using the same wrapper for every row keeps label spacing and error placement
 * consistent, and stops a visible error from shifting the layout of its
 * neighbours because the message animates its own height.
 */
function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

/** A label with a trailing action, e.g. "Password ... Forgot password?". */
function FieldHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-header"
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    />
  );
}

function FieldError({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn("overflow-hidden text-xs text-destructive", className)}
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export { Field, FieldError, FieldHeader, FieldLabel };
