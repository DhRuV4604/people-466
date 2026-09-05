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
};

/**
 * A date field is a button that opens a calendar, not a text input: it removes
 * every parsing and format question. The trigger shows the chosen date and
 * closes the popover on selection.
 */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  invalid = false,
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

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
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
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
