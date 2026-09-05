"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";

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
  /**
   * Force the filter box on or off. Left alone, it appears once the list is
   * long enough to be worth typing at.
   */
  searchable?: boolean;
};

/**
 * Past this many options, scrolling stops being the fastest way to find one.
 * Twenty-nine employees is the case this exists for; five statuses is not.
 */
const SEARCH_THRESHOLD = 8;

/** Case- and punctuation-insensitive, so "o'brien" finds "O'Brien". */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * A select built on the animated menu rather than a native popup, so its open
 * and close match every other overlay in the app. The trigger shares the input
 * shell, so a select and a text field are the same height and radius, and the
 * menu opens at the trigger's own width.
 *
 * A long list gets a filter box automatically. It is decided here rather than
 * asked for at each call site: the same employee list is offered on a dozen
 * screens, and whether it is worth typing at is a property of the list, not of
 * the screen showing it.
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
  searchable,
}: SelectProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const current = value ?? uncontrolled;
  const selected = options.find((option) => option.value === current);

  const filtering = searchable ?? options.length > SEARCH_THRESHOLD;

  /**
   * Puts the cursor in the filter box when the menu opens.
   *
   * `autoFocus` is not enough: inside a dialog the focus trap claims focus
   * after this mounts, and the menu moves it to the first item besides. Both
   * settle within a frame, so this takes it back on the next one — otherwise
   * the box someone opened to type into needs a click first.
   */
  React.useEffect(() => {
    if (!open || !filtering) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => searchRef.current?.focus());
    });
    return () => cancelAnimationFrame(frame);
  }, [open, filtering]);

  const matches = React.useMemo(() => {
    const term = normalise(query);
    if (!term) return options;
    return options.filter((option) => normalise(option.label).includes(term));
  }, [options, query]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Cleared on close so reopening does not resume someone else's search.
        if (!next) setQuery("");
      }}
    >
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
            className={cn("truncate", !selected && "text-muted-foreground/70")}
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
          filtering && "max-h-80 overflow-y-auto",
          menuClassName,
        )}
      >
        {filtering ? (
          <div
            // The menu moves focus with arrow keys and types-to-search of its
            // own; both would fight the input. Stopping the keys here leaves
            // the field behaving like a field.
            onKeyDown={(event) => event.stopPropagation()}
            className="sticky top-0 z-10 -mx-1 -mt-1 mb-1 flex items-center gap-2 border-b border-border bg-popover px-3 py-2"
          >
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to filter"
              aria-label="Filter options"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        ) : null}

        {matches.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </p>
        ) : (
          <DropdownMenuRadioGroup
            value={current}
            onValueChange={(next) => {
              setUncontrolled(next);
              onValueChange?.(next);
            }}
          >
            {matches.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Select, type SelectOption, type SelectProps };
