"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  DayPicker,
  getDefaultClassNames,
  useDayPicker,
  type DayButton,
  type Locale,
  type MonthCaptionProps,
} from "react-day-picker"

import { buttonVariants } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"

/**
 * The month and year as two dropdowns rather than a label.
 *
 * A label plus arrows means twelve clicks to reach last January and rather
 * more to reach a birth year, which is exactly what a hire date or a date of
 * birth asks for. These are the app's own `Select`, so the menu that opens is
 * the same animated one every other field uses rather than a native popup.
 */
function CalendarCaption({
  calendarMonth,
  // Destructured and dropped: react-day-picker's own props, which React would
  // otherwise warn about on the div below.
  displayIndex: _displayIndex,
  years,
  locale,
  ...props
}: MonthCaptionProps & {
  years: number[]
  locale?: Partial<Locale>
}) {
  const { goToMonth } = useDayPicker()
  const shown = calendarMonth.date

  const months = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        value: String(month),
        label: new Date(2000, month, 1).toLocaleString(locale?.code, {
          month: "long",
        }),
      })),
    [locale?.code]
  )

  const yearOptions = React.useMemo(
    () => years.map((year) => ({ value: String(year), label: String(year) })),
    [years]
  )

  return (
    <div {...props}>
      <Select
        size="sm"
        aria-label="Month"
        className="w-32 border-transparent bg-transparent font-medium shadow-none hover:bg-muted"
        value={String(shown.getMonth())}
        options={months}
        onValueChange={(value) =>
          goToMonth(new Date(shown.getFullYear(), Number(value), 1))
        }
      />
      <Select
        size="sm"
        aria-label="Year"
        className="w-[5.5rem] border-transparent bg-transparent font-medium shadow-none hover:bg-muted"
        // The list is long, so the menu scrolls rather than growing past the
        // popover it sits in.
        menuClassName="max-h-64 overflow-y-auto"
        value={String(shown.getFullYear())}
        options={yearOptions}
        onValueChange={(value) =>
          goToMonth(new Date(Number(value), shown.getMonth(), 1))
        }
      />
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  fromYear,
  toYear,
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: Parameters<typeof buttonVariants>[0] extends infer P ? (P extends { variant?: infer V } ? V : never) : never
  /** Earliest year the dropdown offers. Defaults to 80 years back, which covers a date of birth. */
  fromYear?: number
  /** Latest year offered. Defaults to 10 years ahead, which covers a contract end. */
  toYear?: number
}) {
  const defaultClassNames = getDefaultClassNames()

  const years = React.useMemo(() => {
    const now = new Date().getFullYear()
    const first = fromYear ?? now - 80
    const last = toYear ?? now + 10
    // Newest first: a hire date or a contract date is far more often recent
    // than not, so the useful end of the list is the end you land on.
    return Array.from({ length: last - first + 1 }, (_, i) => last - i)
  }, [fromYear, toYear])

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          // The bar spans the full width to push the arrows to either end, so
          // it would otherwise sit on top of the caption and swallow clicks on
          // the month and year dropdowns. Only the buttons take pointers.
          "pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "pointer-events-auto size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "pointer-events-auto size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          // Tall enough for the dropdowns, and padded past the nav arrows that
          // sit absolutely positioned at either end.
          "flex h-9 w-full items-center justify-center gap-1 px-(--cell-size)",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-(--cell-radius)",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 bg-popover opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[0.8rem] text-muted-foreground select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)"
            : "[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)",
          defaultClassNames.day
        ),
        range_start: cn(
          "relative isolate z-0 rounded-l-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "relative isolate z-0 rounded-r-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted",
          defaultClassNames.range_end
        ),
        today: cn(
          "rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon className={cn("size-4", className)} {...props} />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        DayButton: ({ ...props }) => (
          <CalendarDayButton locale={locale} {...props} />
        ),
        MonthCaption: (captionProps) => (
          <CalendarCaption years={years} locale={locale} {...captionProps} />
        ),
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
        buttonVariants({ variant: "ghost" }),
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
