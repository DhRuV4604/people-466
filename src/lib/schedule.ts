import { parseTimeToHours, round2, eachDay } from './utils';

export interface ScheduleLineInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakHours: number;
}

/**
 * Weekly hours are always derived from the schedule lines, never typed in by hand
 * (spec A3). Overnight lines (end <= start) roll over to the next day.
 */
export function computeWeeklyHours(lines: ScheduleLineInput[]): number {
  const total = lines.reduce((sum, line) => sum + lineHours(line), 0);
  return round2(total);
}

export function lineHours(line: ScheduleLineInput): number {
  const start = parseTimeToHours(line.startTime);
  const end = parseTimeToHours(line.endTime);
  const span = end > start ? end - start : 24 - start + end;
  return Math.max(0, span - (line.breakHours || 0));
}

/** Days of the week the schedule actually covers, used for leave-duration maths. */
export function scheduledDays(lines: ScheduleLineInput[]): Set<number> {
  return new Set(lines.map((l) => l.dayOfWeek));
}

export function hoursForDay(lines: ScheduleLineInput[], dayOfWeek: number): number {
  return round2(
    lines.filter((l) => l.dayOfWeek === dayOfWeek).reduce((sum, l) => sum + lineHours(l), 0)
  );
}

/** Average hours in a scheduled working day; falls back to 8h for empty schedules. */
export function averageDayHours(lines: ScheduleLineInput[]): number {
  const days = scheduledDays(lines);
  if (days.size === 0) return 8;
  return round2(computeWeeklyHours(lines) / days.size);
}

/**
 * Number of scheduled working days in an inclusive date range. This is what
 * drives expected attendance and payslip worked-day counts, rather than a flat
 * 30-day assumption.
 */
export function workingDaysInRange(
  lines: ScheduleLineInput[],
  from: Date,
  to: Date
): number {
  const days = scheduledDays(lines);
  if (days.size === 0) return 0;
  return eachDay(from, to).filter((d) => days.has(d.getDay())).length;
}

export function workingHoursInRange(
  lines: ScheduleLineInput[],
  from: Date,
  to: Date
): number {
  return round2(
    eachDay(from, to).reduce((sum, d) => sum + hoursForDay(lines, d.getDay()), 0)
  );
}

/** Default 9-to-6 Mon–Fri pattern used when seeding or creating a new schedule. */
export function defaultWeekPattern(): ScheduleLineInput[] {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: '09:00',
    endTime: '18:00',
    breakHours: 1,
  }));
}
