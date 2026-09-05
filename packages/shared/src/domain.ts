/**
 * Pure domain calculations with no I/O.
 *
 * These live in the shared package because the web client uses them for live
 * previews (weekly hours as a schedule is edited, estimated leave duration)
 * while the API uses the very same functions as the authority when persisting.
 * Keeping one implementation prevents the preview and the stored value drifting.
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** "HH:MM" to fractional hours. */
export function parseTimeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

export interface ScheduleLineInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakHours: number;
}

/** Net hours for one schedule line; an end at or before the start wraps overnight. */
export function lineHours(line: ScheduleLineInput): number {
  const start = parseTimeToHours(line.startTime);
  const end = parseTimeToHours(line.endTime);
  const span = end > start ? end - start : 24 - start + end;
  return Math.max(0, span - (line.breakHours || 0));
}

/** Weekly hours are always derived from the pattern, never entered by hand. */
export function computeWeeklyHours(lines: ScheduleLineInput[]): number {
  return round2(lines.reduce((sum, line) => sum + lineHours(line), 0));
}

export function scheduledDays(lines: ScheduleLineInput[]): Set<number> {
  return new Set(lines.map((l) => l.dayOfWeek));
}

export function hoursForDay(lines: ScheduleLineInput[], dayOfWeek: number): number {
  return round2(
    lines.filter((l) => l.dayOfWeek === dayOfWeek).reduce((sum, l) => sum + lineHours(l), 0)
  );
}

/** Average hours in a scheduled working day; falls back to 8h for an empty schedule. */
export function averageDayHours(lines: ScheduleLineInput[]): number {
  const days = scheduledDays(lines);
  if (days.size === 0) return 8;
  return round2(computeWeeklyHours(lines) / days.size);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfDay(from);
  const last = startOfDay(to);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Scheduled working days in an inclusive range. This drives expected attendance
 * and payslip worked-day counts instead of a flat 30-day month assumption.
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
  return round2(eachDay(from, to).reduce((sum, d) => sum + hoursForDay(lines, d.getDay()), 0));
}

/**
 * Leave duration counts only days the employee was scheduled to work, so a
 * Friday-to-Monday request on a Mon-Fri schedule costs two days, not four.
 */
export function computeLeaveDuration(
  from: Date,
  to: Date,
  scheduleLines: ScheduleLineInput[],
  unit: 'DAY' | 'HOUR'
): number {
  const working =
    scheduleLines.length > 0 ? scheduledDays(scheduleLines) : new Set([1, 2, 3, 4, 5]);
  const days = eachDay(from, to).filter((d) => working.has(d.getDay())).length;

  if (unit === 'HOUR') {
    const perDay = scheduleLines.length > 0 ? averageDayHours(scheduleLines) : 8;
    return round2(days * perDay);
  }
  return days;
}

/** Inclusive overlap test; a null end date means open-ended. */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date | null
): boolean {
  const aEndValue = aEnd ? aEnd.getTime() : Infinity;
  const bEndValue = bEnd ? bEnd.getTime() : Infinity;
  return aStart.getTime() <= bEndValue && bStart.getTime() <= aEndValue;
}

/**
 * The minimum a record needs for period resolution. Deliberately excludes wage:
 * resolution never reads it, and requiring `number` here would reject the
 * Decimal-typed rows the API passes straight from Prisma.
 */
export interface ContractLike {
  id: string;
  dateStart: Date;
  dateEnd: Date | null;
  status: string;
}

/**
 * Resolve the single contract governing a payroll period.
 *
 * A contract qualifies when it is RUNNING and overlaps the period. If several
 * qualify - which the overlap guard is meant to prevent, though legacy data may
 * still contain - the latest start wins, being the most recent agreed terms.
 */
export function resolveContractForPeriod<T extends ContractLike>(
  contracts: T[],
  periodStart: Date,
  periodEnd: Date
): T | null {
  const applicable = contracts
    .filter((c) => c.status === 'RUNNING')
    .filter((c) => rangesOverlap(c.dateStart, c.dateEnd, periodStart, periodEnd));

  if (applicable.length === 0) return null;
  return applicable.sort((a, b) => b.dateStart.getTime() - a.dateStart.getTime())[0];
}
