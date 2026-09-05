"use client";

import * as React from "react";

import { Checkbox as AnimatedCheckbox } from "@/components/animate-ui/components/radix/checkbox";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentProps<typeof AnimatedCheckbox>;

/**
 * The Animate UI checkbox with the app's radius applied, so it matches the
 * inputs and buttons.
 */
function Checkbox({ className, size = "sm", ...props }: CheckboxProps) {
  return (
    <AnimatedCheckbox
      size={size}
      className={cn("rounded-[6px]", className)}
      {...props}
    />
  );
}

/** Checkbox plus its clickable label, aligned on one row. */
function CheckboxField({
  id,
  children,
  className,
  ...props
}: CheckboxProps & { children: React.ReactNode }) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground select-none"
    >
      <Checkbox id={id} className={className} {...props} />
      {children}
    </label>
  );
}

export { Checkbox, CheckboxField, type CheckboxProps };
