"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/animate-ui/components/radix/dropdown-menu";
import { fieldSurfaceVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  options: SelectOption[];
  /** Controlled value. Omit for an uncontrolled select. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Width of the menu. Defaults to matching the trigger. */
  menuClassName?: string;
};

/**
 * A select built on the animated menu rather than a native popup, so its open
 * and close match every other overlay in the app. The trigger shares the input
 * shell, so a select and a text field are the same height and radius, and the
 * menu opens at the trigger's own width.
 */
function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select an option",
  size = "lg",
  invalid = false,
  disabled = false,
  id,
  className,
  menuClassName,
}: SelectProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const current = value ?? uncontrolled;
  const selected = options.find((option) => option.value === current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          data-invalid={invalid ? "true" : undefined}
          data-slot="select-trigger"
          className={cn(
            fieldSurfaceVariants({ size }),
            "group cursor-pointer justify-between text-left outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        >
          <span
            className={cn(
              "truncate",
              !selected && "text-muted-foreground/70",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={cn(
          "min-w-(--radix-dropdown-menu-trigger-width)",
          menuClassName,
        )}
      >
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(next) => {
            setUncontrolled(next);
            onValueChange?.(next);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Select, type SelectOption, type SelectProps };
