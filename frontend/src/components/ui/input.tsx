"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Inputs are composed, not stacked. `InputGroup` owns the border, height and
 * focus ring; `InputAddon` holds leading/trailing content such as an icon or a
 * reveal button. Because the addons are flex children rather than absolutely
 * positioned overlays, they can never drift out of the field.
 *
 *   <InputGroup invalid={...}>
 *     <InputAddon><MailIcon /></InputAddon>
 *     <Input ... />
 *     <InputAddon side="end"><IconButton ... /></InputAddon>
 *   </InputGroup>
 *
 * `fieldSurfaceVariants` is the shared shell for anything that has to sit
 * alongside an input and look identical, such as the select trigger.
 */
const fieldSurfaceVariants = cva(
  [
    "flex w-full items-center gap-2 rounded-xl border bg-background",
    "border-input text-sm transition-[color,border-color,box-shadow]",
    "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring",
    "has-[input:disabled]:opacity-60",
    "data-[invalid=true]:border-destructive data-[invalid=true]:focus-within:ring-destructive/25",
  ].join(" "),
  {
    variants: {
      size: {
        // For a secondary row — a table footer, say — where a 44px control
        // would outweigh what it does.
        sm: "h-9 px-2.5 text-sm",
        md: "h-11 px-3",
        lg: "h-12 px-4",
      },
    },
    defaultVariants: { size: "lg" },
  },
);

const inputGroupVariants = fieldSurfaceVariants;

type InputGroupProps = Omit<React.ComponentProps<"div">, "size"> &
  VariantProps<typeof fieldSurfaceVariants> & {
    invalid?: boolean;
  };

function InputGroup({ className, size, invalid, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      data-invalid={invalid ? "true" : undefined}
      className={cn(fieldSurfaceVariants({ size, className }))}
      {...props}
    />
  );
}

type InputAddonProps = React.ComponentProps<"div"> & {
  side?: "start" | "end";
};

function InputAddon({ className, side = "start", ...props }: InputAddonProps) {
  return (
    <div
      data-slot="input-addon"
      data-side={side}
      className={cn(
        "flex shrink-0 items-center justify-center text-muted-foreground",
        "[&_svg]:size-[18px] [&_svg]:shrink-0",
        side === "end" ? "-mr-1.5" : "-ml-0.5",
        className,
      )}
      {...props}
    />
  );
}

type InputProps = React.ComponentProps<"input">;

function Input({ className, ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-full min-w-0 flex-1 bg-transparent text-foreground outline-none",
        "placeholder:text-muted-foreground/70",
        "disabled:cursor-not-allowed",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export {
  Input,
  InputAddon,
  InputGroup,
  fieldSurfaceVariants,
  inputGroupVariants,
  type InputAddonProps,
  type InputGroupProps,
  type InputProps,
};
