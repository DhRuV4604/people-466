import { prisma } from './prisma';
import { round2, startOfDay, endOfDay, parseTimeToHours } from './utils';
import { hoursForDay, type ScheduleLineInput } from './schedule';

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'MISSING_CHECKOUT',
  'HALF_DAY',
] as const;

/** Grace period before a check-in counts as late. */
const LATE_GRACE_MINUTES = 15;

export interface AttendanceComputation {
  workedHours: number;
  overtimeHours: number;
  status: string;
}

/**
 * Derive worked hours, overtime and exception status from the raw punches plus
 * the employee's schedule for that weekday (spec B3). An open check-in is not an
 * error in itself - it becomes MISSING_CHECKOUT only once the day has passed.
 */
export function computeAttendance(
  checkIn: Date,
  checkOut: Date | null,
  scheduleLines: ScheduleLineInput[],
  now: Date = new Date()
): AttendanceComputation {
  const dayOfWeek = checkIn.getDay();
  const expectedHours = scheduleLines.length > 0 ? hoursForDay(scheduleLines, dayOfWeek) : 8;

  if (!checkOut) {
    const stillToday = startOfDay(checkIn).getTime() === startOfDay(now).getTime();
    return {
      workedHours: 0,
      overtimeHours: 0,
      status: stillToday ? 'PRESENT' : 'MISSING_CHECKOUT',
    };
  }

  const rawHours = (checkOut.getTime() - checkIn.getTime()) / 3_600_000;
  const breakHours = scheduleLines
    .filter((l) => l.dayOfWeek === dayOfWeek)
    .reduce((s, l) => s + (l.breakHours || 0), 0);

  // Only subtract the break when the shift actually ran long enough to take one.
  const workedHours = round2(Math.max(0, rawHours - (rawHours > breakHours ? breakHours : 0)));
  const overtimeHours = round2(Math.max(0, workedHours - expectedHours));

  let status = 'PRESENT';

  const scheduledStart = scheduleLines.find((l) => l.dayOfWeek === dayOfWeek)?.startTime;
  if (scheduledStart) {
    const expectedStartHours = parseTimeToHours(scheduledStart);
    const actualStartHours = checkIn.getHours() + checkIn.getMinutes() / 60;
    if (actualStartHours > expectedStartHours + LATE_GRACE_MINUTES / 60) status = 'LATE';
  }

  if (expectedHours > 0 && workedHours < expectedHours / 2) status = 'HALF_DAY';

  return { workedHours, overtimeHours, status };
}

export async function getScheduleLinesForEmployee(
  employeeId: string
): Promise<ScheduleLineInput[]> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { workingSchedule: { include: { lines: true } } },
  });
  return employee?.workingSchedule?.lines ?? [];
}

/** Recompute and persist a stored attendance row after an edit. */
export async function recomputeAttendance(attendanceId: string) {
  const record = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      employee: { include: { workingSchedule: { include: { lines: true } } } },
    },
  });
  if (!record) return null;

  const computed = computeAttendance(
    record.checkIn,
    record.checkOut,
    record.employee.workingSchedule?.lines ?? []
  );

  return prisma.attendance.update({ where: { id: attendanceId }, data: computed });
}

export interface AttendanceSummary {
  totalRecords: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  missingCheckout: number;
  manualEdits: number;
  totalWorkedHours: number;
  totalOvertimeHours: number;
  /** Share of records that are clean (present, checked out, not corrected). */
  healthPercent: number;
  coveragePercent: number;
}

export async function getAttendanceSummary(params: {
  from: Date;
  to: Date;
  departmentId?: string | null;
  employeeType?: string | null;
  employeeId?: string | null;
}): Promise<AttendanceSummary> {
  const records = await prisma.attendance.findMany({
    where: {
      checkIn: { gte: startOfDay(params.from), lte: endOfDay(params.to) },
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.departmentId || params.employeeType
        ? {
            employee: {
              ...(params.departmentId ? { departmentId: params.departmentId } : {}),
              ...(params.employeeType ? { employeeType: params.employeeType } : {}),
            },
          }
        : {}),
    },
  });

  const count = (status: string) => records.filter((r) => r.status === status).length;

  const present = count('PRESENT');
  const late = count('LATE');
  const absent = count('ABSENT');
  const halfDay = count('HALF_DAY');
  const missingCheckout = count('MISSING_CHECKOUT');
  const manualEdits = records.filter((r) => r.manuallyEdited).length;

  const totalWorkedHours = round2(records.reduce((s, r) => s + r.workedHours, 0));
  const totalOvertimeHours = round2(records.reduce((s, r) => s + r.overtimeHours, 0));

  const clean = present;
  const healthPercent = records.length > 0 ? round2((clean / records.length) * 100) : 100;

  // Coverage = share of records with both punches recorded.
  const withBoth = records.filter((r) => r.checkOut !== null).length;
  const coveragePercent = records.length > 0 ? round2((withBoth / records.length) * 100) : 100;

  return {
    totalRecords: records.length,
    present,
    late,
    absent,
    halfDay,
    missingCheckout,
    manualEdits,
    totalWorkedHours,
    totalOvertimeHours,
    healthPercent,
    coveragePercent,
  };
}

/** Worked days/hours feeding payslip computation for a period. */
export async function getWorkedTimeInPeriod(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ days: number; hours: number; overtime: number }> {
  const records = await prisma.attendance.findMany({
    where: {
      employeeId,
      checkIn: { gte: startOfDay(periodStart), lte: endOfDay(periodEnd) },
      status: { not: 'ABSENT' },
    },
  });

  const days = new Set(records.map((r) => startOfDay(r.checkIn).toISOString())).size;
  const hours = round2(records.reduce((s, r) => s + r.workedHours, 0));
  const overtime = round2(records.reduce((s, r) => s + r.overtimeHours, 0));

  return { days, hours, overtime };
}
