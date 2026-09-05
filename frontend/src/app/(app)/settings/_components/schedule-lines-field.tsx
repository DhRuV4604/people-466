"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import {
  DAY_NAMES,
  DAY_SHORT,
  computeWeeklyHours,
  lineHours,
  type ScheduleLineInput,
  type WorkingScheduleLineDto,
} from "@peoplepay360/shared";

import { IconButton, Input, InputGroup, Switch } from "@/components/ui";
import { hours } from "@/lib/format";

/** Monday first: a working week reads better than a calendar one. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

type Shift = {
  startTime: string;
  endTime: string;
  /** Held as text so the input can be emptied mid-edit. */
  breakHours: string;
};

/** One entry per weekday, indexed the way the API numbers them. */
type Week = Shift[][];

const NINE_TO_FIVE: Shift = {
  startTime: "09:00",
  endTime: "17:00",
  breakHours: "0",
};

/** Monday to Friday, nine to five: the pattern most schedules start from. */
function defaultWeek(): Week {
  return DAY_NAMES.map((_, day) =>
    day >= 1 && day <= 5 ? [{ ...NINE_TO_FIVE }] : [],
  );
}

/**
 * A day may hold more than one line, which is how a split shift is stored, so
 * every line is kept. Collapsing a day to a single row would delete the shifts
 * it could not show, the next time the schedule was saved.
 */
function toWeek(lines: WorkingScheduleLineDto[]): Week {
  const week: Week = DAY_NAMES.map(() => []);
  for (const line of lines) {
    week[line.dayOfWeek]?.push({
      startTime: line.startTime,
      endTime: line.endTime,
      breakHours: String(line.breakHours ?? 0),
    });
  }
  return week;
}

function toLine(day: number, shift: Shift): ScheduleLineInput {
  return {
    dayOfWeek: day,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakHours: Number(shift.breakHours) || 0,
  };
}

/**
 * The weekly pattern, which the generic form cannot express as a field. It
 * writes the lines into a hidden input as JSON, paired with the `lines` field
 * spec, and is passed to the dialog through its `extras` slot.
 *
 * The weekly total is shown as it is edited because payroll divides by it to
 * get a day rate, so the number is worth seeing before the record is saved.
 * It uses the same derivation the API applies when persisting.
 */
export function ScheduleLinesField({
  defaultLines,
}: {
  defaultLines?: WorkingScheduleLineDto[];
}) {
  const [week, setWeek] = React.useState<Week>(() =>
    defaultLines?.length ? toWeek(defaultLines) : defaultWeek(),
  );

  const setDay = React.useCallback((day: number, shifts: Shift[]) => {
    setWeek((current) =>
      current.map((entry, index) => (index === day ? shifts : entry)),
    );
  }, []);

  const lines = WEEK.flatMap((day) =>
    week[day].map((shift) => toLine(day, shift)),
  );
  const incomplete = lines.some((line) => !line.startTime || !line.endTime);

  // A half-entered time totals as NaN, so the figure waits for the pattern to
  // make sense rather than showing a number nobody can act on.
  const total = incomplete ? 0 : computeWeeklyHours(lines);

  return (
    <div className="rounded-xl border border-input">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <span className="text-sm font-medium">Working days</span>
        <span className="text-xs text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground">
            {hours(total)}
          </span>{" "}
          per week
        </span>
      </div>

      <div className="divide-y divide-border">
        {WEEK.map((day) => {
          const shifts = week[day];

          return (
            <div
              key={day}
              className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-2.5"
            >
              <div className="flex w-20 shrink-0 items-center gap-2.5 py-1.5">
                <Switch
                  id={`day-${day}`}
                  checked={shifts.length > 0}
                  onCheckedChange={(worked) =>
                    setDay(day, worked ? [{ ...NINE_TO_FIVE }] : [])
                  }
                />
                <label htmlFor={`day-${day}`} className="text-sm select-none">
                  {DAY_SHORT[day]}
                </label>
              </div>

              {shifts.length === 0 ? (
                <span className="py-2 text-xs text-muted-foreground">
                  Not worked
                </span>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {shifts.map((shift, index) => {
                    // A day with one shift needs no ordinal; a split one does.
                    const named =
                      shifts.length > 1
                        ? `${DAY_NAMES[day]} shift ${index + 1}`
                        : DAY_NAMES[day];
                    const complete = Boolean(shift.startTime && shift.endTime);

                    const update = (patch: Partial<Shift>) =>
                      setDay(
                        day,
                        shifts.map((entry, at) =>
                          at === index ? { ...entry, ...patch } : entry,
                        ),
                      );

                    return (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <InputGroup size="md" className="h-9 w-28 px-2.5">
                          <Input
                            type="time"
                            aria-label={`${named} start`}
                            value={shift.startTime}
                            onChange={(event) =>
                              update({ startTime: event.target.value })
                            }
                          />
                        </InputGroup>

                        <span className="text-xs text-muted-foreground">
                          to
                        </span>

                        <InputGroup size="md" className="h-9 w-28 px-2.5">
                          <Input
                            type="time"
                            aria-label={`${named} end`}
                            value={shift.endTime}
                            onChange={(event) =>
                              update({ endTime: event.target.value })
                            }
                          />
                        </InputGroup>

                        <InputGroup size="md" className="h-9 w-20 px-2.5">
                          <Input
                            type="number"
                            min={0}
                            step={0.25}
                            aria-label={`${named} break in hours`}
                            value={shift.breakHours}
                            onChange={(event) =>
                              update({ breakHours: event.target.value })
                            }
                          />
                        </InputGroup>

                        <span className="text-xs text-muted-foreground">
                          break
                        </span>

                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          {complete
                            ? hours(lineHours(toLine(day, shift)))
                            : "Needs a time"}
                        </span>

                        {shifts.length > 1 ? (
                          <IconButton
                            icon={<X />}
                            label={`Remove ${named}`}
                            size="sm"
                            onClick={() =>
                              setDay(
                                day,
                                shifts.filter((_, at) => at !== index),
                              )
                            }
                          />
                        ) : null}

                        {index === shifts.length - 1 ? (
                          <IconButton
                            icon={<Plus />}
                            label={`Add another ${DAY_NAMES[day]} shift`}
                            size="sm"
                            onClick={() =>
                              setDay(day, [...shifts, { ...NINE_TO_FIVE }])
                            }
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lines.length === 0 || incomplete ? (
        <p className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
          {lines.length === 0
            ? "Turn on at least one day. A schedule with no working days cannot be saved."
            : "Every shift needs a start and an end time."}
        </p>
      ) : null}
    </div>
  );
}
