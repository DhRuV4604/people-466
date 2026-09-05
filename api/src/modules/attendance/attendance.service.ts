import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  hoursForDay,
  parseTimeToHours,
  type ScheduleLineInput,
  type AttendanceDto,
  type AttendanceSummaryDto,
} from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppSettingsService } from '../config/app-settings.service';
import { pageArgs, paginated } from '../../common/pagination';
import { toNumber, toDecimal, round2 } from '../../common/decimal';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateAttendanceDto,
  UpdateAttendanceDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';
import { NO_MATCH_ID } from '../../common/scoping';
import type { Paginated, PunchStatusDto } from '@peoplepay360/shared';

/** Minutes after the scheduled start before an arrival counts as late. */
const LATE_GRACE_MINUTES = 15;

const ATTENDANCE_INCLUDE = {
  employee: { include: { department: true } },
} satisfies Prisma.AttendanceInclude;

type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  include: typeof ATTENDANCE_INCLUDE;
}>;

export interface AttendanceComputation {
  workedHours: number;
  overtimeHours: number;
  status: 'PRESENT' | 'LATE' | 'MISSING_CHECKOUT' | 'HALF_DAY';
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /**
   * The UTC day `at` falls in, as a half-open range. The self-service space
   * reads attendance in UTC calendar days throughout, so the cap has to count
   * the same day the employee is looking at.
   */
  private utcDay(at: Date): { start: Date; end: Date } {
    const start = new Date(
      Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
    );
    return { start, end: new Date(start.getTime() + 86_400_000) };
  }

  /**
   * How many times this employee has checked in today and how many they have
   * left. An open shift counts: it was a check-in, whether or not it is closed
   * yet, so closing it cannot buy another one.
   */
  async getPunchStatus(
    employeeId: string,
    now: Date = new Date()
  ): Promise<PunchStatusDto> {
    const policy = await this.settings.get();
    const { start, end } = this.utcDay(now);

    const [used, open] = await this.prisma.$transaction([
      this.prisma.attendance.count({
        where: { employeeId, checkIn: { gte: start, lt: end } },
      }),
      // Deliberately unbounded by date: this is the same condition `checkIn`
      // refuses on, so the card and the endpoint cannot disagree about whether
      // a shift is running.
      this.prisma.attendance.findFirst({
        where: { employeeId, checkOut: null },
        select: { id: true, checkIn: true },
        orderBy: { checkIn: 'desc' },
      }),
    ]);

    return {
      used,
      allowed: policy.maxCheckInsPerDay,
      remaining: Math.max(0, policy.maxCheckInsPerDay - used),
      warnOnCheckOut: policy.warnOnCheckOut,
      openCheckIn: open
        ? { id: open.id, checkIn: open.checkIn.toISOString() }
        : null,
    };
  }

  /**
   * Derive worked hours, overtime and exception status from the raw punches plus
   * the schedule for that weekday. An open check-in is not an error in itself -
   * it only becomes MISSING_CHECKOUT once the day has passed.
   */
  computeAttendance(
    checkIn: Date,
    checkOut: Date | null,
    scheduleLines: ScheduleLineInput[],
    now: Date = new Date()
  ): AttendanceComputation {
    const dayOfWeek = checkIn.getDay();
    const expectedHours = scheduleLines.length > 0 ? hoursForDay(scheduleLines, dayOfWeek) : 8;

    if (!checkOut) {
      const sameDay = checkIn.toDateString() === now.toDateString();
      return {
        workedHours: 0,
        overtimeHours: 0,
        status: sameDay ? 'PRESENT' : 'MISSING_CHECKOUT',
      };
    }

    const rawHours = (checkOut.getTime() - checkIn.getTime()) / 3_600_000;
    const breakHours = scheduleLines
      .filter((l) => l.dayOfWeek === dayOfWeek)
      .reduce((s, l) => s + (l.breakHours || 0), 0);

    // Only deduct the break when the shift actually ran long enough to take one.
    const workedHours = round2(Math.max(0, rawHours - (rawHours > breakHours ? breakHours : 0)));
    const overtimeHours = round2(Math.max(0, workedHours - expectedHours));

    let status: AttendanceComputation['status'] = 'PRESENT';

    const scheduledStart = scheduleLines.find((l) => l.dayOfWeek === dayOfWeek)?.startTime;
    if (scheduledStart) {
      const expectedStart = parseTimeToHours(scheduledStart);
      const actualStart = checkIn.getHours() + checkIn.getMinutes() / 60;
      if (actualStart > expectedStart + LATE_GRACE_MINUTES / 60) status = 'LATE';
    }

    if (expectedHours > 0 && workedHours < expectedHours / 2) status = 'HALF_DAY';

    return { workedHours, overtimeHours, status };
  }

  private toDto(a: AttendanceWithRelations, editedByName?: string | null): AttendanceDto {
    return {
      id: a.id,
      employeeId: a.employeeId,
      employee: {
        id: a.employee.id,
        fullName: `${a.employee.firstName} ${a.employee.lastName}`,
        department: a.employee.department?.name ?? null,
      },
      checkIn: a.checkIn.toISOString(),
      checkOut: a.checkOut?.toISOString() ?? null,
      workedHours: toNumber(a.workedHours),
      overtimeHours: toNumber(a.overtimeHours),
      status: a.status,
      manuallyEdited: a.manuallyEdited,
      editedById: a.editedById,
      editedByName: editedByName ?? null,
      editedAt: a.editedAt?.toISOString() ?? null,
      editReason: a.editReason,
      notes: a.notes,
    };
  }

  private async scheduleLinesFor(employeeId: string): Promise<ScheduleLineInput[]> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { workingSchedule: { include: { lines: true } } },
    });

    return (employee?.workingSchedule?.lines ?? []).map((l) => ({
      dayOfWeek: l.dayOfWeek,
      startTime: l.startTime,
      endTime: l.endTime,
      breakHours: toNumber(l.breakHours),
    }));
  }

  async findAll(
    query: QueryAttendanceDto,
    user: AuthenticatedUser
  ): Promise<Paginated<AttendanceDto>> {
    const scoped =
      user.role === 'EMPLOYEE' ? { employeeId: user.employeeId ?? NO_MATCH_ID } : {};

    const now = new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = query.to ? new Date(`${query.to}T23:59:59.999`) : now;

    // Hoisted so the count applies exactly the same filter as the page.
    const where: Prisma.AttendanceWhereInput = {
      ...scoped,
      checkIn: { gte: from, lte: to },
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { employee: { firstName: { contains: query.q, mode: 'insensitive' as const } } },
              { employee: { lastName: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const { skip, take, page, pageSize } = pageArgs(query);

    const [records, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        include: ATTENDANCE_INCLUDE,
        orderBy: { checkIn: 'desc' },
        skip,
        take,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return paginated(
      records.map((r) => this.toDto(r)),
      total,
      page,
      pageSize
    );
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<AttendanceDto> {
    const record = await this.prisma.attendance.findUnique({
      where: { id },
      include: ATTENDANCE_INCLUDE,
    });
    if (!record) throw new NotFoundException('Attendance record not found.');

    if (user.role === 'EMPLOYEE' && record.employeeId !== user.employeeId) {
      throw new NotFoundException('Attendance record not found.');
    }

    const editor = record.editedById
      ? await this.prisma.user.findUnique({
          where: { id: record.editedById },
          select: { name: true },
        })
      : null;

    return this.toDto(record, editor?.name ?? null);
  }

  async create(dto: CreateAttendanceDto, user: AuthenticatedUser): Promise<AttendanceDto> {
    // Employees may only ever record their own attendance.
    const employeeId = user.role === 'EMPLOYEE' ? user.employeeId : dto.employeeId;
    if (!employeeId) throw new BadRequestException('Employee is required.');

    if (user.role === 'EMPLOYEE' && dto.employeeId && dto.employeeId !== user.employeeId) {
      throw new ForbiddenException('You can only record your own attendance.');
    }

    const checkIn = new Date(dto.checkIn);
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : null;

    if (checkOut && checkOut <= checkIn) {
      throw new BadRequestException('Check-out must be after check-in.');
    }

    // Block a second open or overlapping entry for the same shift.
    const overlapping = await this.prisma.attendance.findFirst({
      where: {
        employeeId,
        checkIn: { lte: checkOut ?? checkIn },
        OR: [{ checkOut: null }, { checkOut: { gte: checkIn } }],
      },
    });
    if (overlapping) {
      throw new BadRequestException('An attendance record already overlaps this time range.');
    }

    const lines = await this.scheduleLinesFor(employeeId);
    const computed = this.computeAttendance(checkIn, checkOut, lines);

    const record = await this.prisma.attendance.create({
      data: {
        employeeId,
        checkIn,
        checkOut,
        workedHours: toDecimal(computed.workedHours),
        overtimeHours: toDecimal(computed.overtimeHours),
        status: computed.status,
        notes: dto.notes ?? null,
      },
      include: ATTENDANCE_INCLUDE,
    });

    return this.toDto(record);
  }

  /** Manual corrections record who changed the entry, when and why. */
  async update(
    id: string,
    dto: UpdateAttendanceDto,
    user: AuthenticatedUser
  ): Promise<AttendanceDto> {
    const existing = await this.prisma.attendance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Attendance record not found.');

    const checkIn = dto.checkIn ? new Date(dto.checkIn) : existing.checkIn;
    const checkOut =
      dto.checkOut !== undefined
        ? dto.checkOut
          ? new Date(dto.checkOut)
          : null
        : existing.checkOut;

    if (checkOut && checkOut <= checkIn) {
      throw new BadRequestException('Check-out must be after check-in.');
    }

    const lines = await this.scheduleLinesFor(existing.employeeId);
    const computed = this.computeAttendance(checkIn, checkOut, lines);

    const timesChanged =
      existing.checkIn.getTime() !== checkIn.getTime() ||
      (existing.checkOut?.getTime() ?? null) !== (checkOut?.getTime() ?? null);

    const record = await this.prisma.attendance.update({
      where: { id },
      data: {
        checkIn,
        checkOut,
        workedHours: toDecimal(computed.workedHours),
        overtimeHours: toDecimal(computed.overtimeHours),
        // An explicit override wins over the derived status, but is still audited.
        status: dto.status ?? computed.status,
        notes: dto.notes ?? existing.notes,
        manuallyEdited: existing.manuallyEdited || timesChanged || Boolean(dto.status),
        editedById: user.userId,
        editedAt: new Date(),
        editReason: dto.editReason ?? existing.editReason,
      },
      include: ATTENDANCE_INCLUDE,
    });

    return this.toDto(record);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.prisma.attendance.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * The same figures for whoever is asking. An account with no employee record
   * cannot punch at all, so it reports nothing left rather than erroring: the
   * card is read-only for them either way.
   */
  async punchStatusFor(user: AuthenticatedUser): Promise<PunchStatusDto> {
    if (!user.employeeId) {
      const policy = await this.settings.get();
      return {
        used: 0,
        allowed: policy.maxCheckInsPerDay,
        remaining: 0,
        warnOnCheckOut: policy.warnOnCheckOut,
        openCheckIn: null,
      };
    }
    return this.getPunchStatus(user.employeeId);
  }

  /** One-click check-in for the signed-in employee. */
  async checkIn(user: AuthenticatedUser): Promise<AttendanceDto> {
    if (!user.employeeId) {
      throw new BadRequestException('No employee record is linked to this account.');
    }

    const open = await this.prisma.attendance.findFirst({
      where: { employeeId: user.employeeId, checkOut: null },
    });
    if (open) throw new BadRequestException('You already have an open check-in.');

    const now = new Date();

    // The day's cap is the reason a closed shift does not free the card up
    // again: without this an employee could punch in and out all day and the
    // attendance report would read as many short shifts rather than one.
    const punches = await this.getPunchStatus(user.employeeId, now);
    if (punches.remaining <= 0) {
      throw new BadRequestException(
        punches.allowed === 1
          ? 'You have already checked in today. Ask HR if you need the day reopened.'
          : `You have used all ${punches.allowed} check-ins allowed today.`
      );
    }

    const lines = await this.scheduleLinesFor(user.employeeId);
    const computed = this.computeAttendance(now, null, lines);

    const record = await this.prisma.attendance.create({
      data: {
        employeeId: user.employeeId,
        checkIn: now,
        workedHours: toDecimal(computed.workedHours),
        overtimeHours: toDecimal(computed.overtimeHours),
        status: computed.status,
      },
      include: ATTENDANCE_INCLUDE,
    });

    return this.toDto(record);
  }

  async checkOut(user: AuthenticatedUser): Promise<AttendanceDto> {
    if (!user.employeeId) {
      throw new BadRequestException('No employee record is linked to this account.');
    }

    const open = await this.prisma.attendance.findFirst({
      where: { employeeId: user.employeeId, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (!open) throw new BadRequestException('No open check-in to close.');

    const lines = await this.scheduleLinesFor(user.employeeId);
    const now = new Date();
    const computed = this.computeAttendance(open.checkIn, now, lines);

    const record = await this.prisma.attendance.update({
      where: { id: open.id },
      data: {
        checkOut: now,
        workedHours: toDecimal(computed.workedHours),
        overtimeHours: toDecimal(computed.overtimeHours),
        status: computed.status,
      },
      include: ATTENDANCE_INCLUDE,
    });

    return this.toDto(record);
  }

  async getSummary(params: {
    from: Date;
    to: Date;
    departmentId?: string | null;
    employeeType?: string | null;
    employeeId?: string | null;
  }): Promise<AttendanceSummaryDto> {
    // Counts and sums only, so they are computed in Postgres rather than by
    // loading every attendance row for the period into Node. This endpoint
    // grows by headcount x days, which is what made it the slowest query here.
    const where: Prisma.AttendanceWhereInput = {
      checkIn: { gte: params.from, lte: params.to },
      ...(params.employeeId ? { employeeId: params.employeeId } : {}),
      ...(params.departmentId || params.employeeType
        ? {
            employee: {
              ...(params.departmentId ? { departmentId: params.departmentId } : {}),
              ...(params.employeeType ? { employeeType: params.employeeType as never } : {}),
            },
          }
        : {}),
    };

    const [byStatus, totals, manualEdits, withBoth] = await Promise.all([
      this.prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.attendance.aggregate({
        where,
        _count: { _all: true },
        _sum: { workedHours: true, overtimeHours: true },
      }),
      this.prisma.attendance.count({ where: { ...where, manuallyEdited: true } }),
      this.prisma.attendance.count({ where: { ...where, checkOut: { not: null } } }),
    ]);

    const count = (status: string) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    const totalRecords = totals._count._all;
    const present = count('PRESENT');

    return {
      totalRecords,
      present,
      late: count('LATE'),
      absent: count('ABSENT'),
      halfDay: count('HALF_DAY'),
      missingCheckout: count('MISSING_CHECKOUT'),
      manualEdits,
      totalWorkedHours: round2(toNumber(totals._sum.workedHours)),
      totalOvertimeHours: round2(toNumber(totals._sum.overtimeHours)),
      healthPercent: totalRecords > 0 ? round2((present / totalRecords) * 100) : 100,
      coveragePercent: totalRecords > 0 ? round2((withBoth / totalRecords) * 100) : 100,
    };
  }

  /** Worked days/hours feeding payslip computation for a period. */
  async getWorkedTimeInPeriod(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ days: number; hours: number; overtime: number }> {
    const records = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        checkIn: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86399999) },
        status: { not: 'ABSENT' },
      },
      select: { checkIn: true, workedHours: true, overtimeHours: true },
    });

    const days = new Set(records.map((r) => r.checkIn.toDateString())).size;
    const hours = round2(records.reduce((s, r) => s + toNumber(r.workedHours), 0));
    const overtime = round2(records.reduce((s, r) => s + toNumber(r.overtimeHours), 0));

    return { days, hours, overtime };
  }
}
