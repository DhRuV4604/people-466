"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  /** Shown when the field has failed validation. */
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  /**
   * Earliest and latest year the dropdown offers. The default window covers a
   * date of birth at one end and a contract that runs on at the other, so no
   * field in the app has to page through the calendar a month at a time.
   */
  fromYear?: number;
  toYear?: number;
};

/** A birth date is the furthest back anything here is picked from. */
const YEARS_BACK = 80;
/** Far enough ahead for an allocation or a contract that runs on. */
const YEARS_AHEAD = 10;

/**
 * A date field is a button that opens a calendar, not a text input: it removes
 * every parsing and format question. The trigger shows the chosen date and
 * closes the popover on selection.
 *
 * The caption is a pair of dropdowns rather than a label, so a year decades
 * away is one click rather than hundreds on the previous-month arrow.
 */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  invalid = false,
  disabled = false,
  className,
  id,
  fromYear,
  toYear,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const thisYear = new Date().getFullYear();
  const first = fromYear ?? thisYear - YEARS_BACK;
  const last = toYear ?? thisYear + YEARS_AHEAD;

  // The range has to contain the stored value, or the dropdown cannot show
  // the year the record already has and the calendar jumps to another one.
  const selectedYear = value && !Number.isNaN(value.getTime())
    ? value.getFullYear()
    : undefined;
  const startYear = Math.min(first, selectedYear ?? first);
  const endYear = Math.max(last, selectedYear ?? last);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          size="lg"
          disabled={disabled}
          aria-invalid={invalid}
          startIcon={<CalendarDays />}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive",
            className,
          )}
        >
          {value ? format(value, "d MMMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={new Date(startYear, 0)}
          endMonth={new Date(endYear, 11)}
          defaultMonth={value ?? undefined}
          selected={value}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker, type DatePickerProps };
