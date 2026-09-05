import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeLeaveDuration,
  eachDay,
  type ScheduleLineInput,
  type LeaveBalanceDto,
  type LeaveRequestDto,
  type LeaveAllocationDto,
  type TimeOffTypeDto,
} from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber, toDecimal, round2 } from '../../common/decimal';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
  QueryLeaveRequestsDto,
  CreateAllocationDto,
  UpdateAllocationDto,
  QueryAllocationsDto,
  UpsertTimeOffTypeDto,
  RefuseRequestDto,
} from './dto/time-off.dto';
import { NO_MATCH_ID } from '../../common/scoping';
import { NotificationsService } from '../notifications/notifications.service';

export interface LeaveValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  allocationId?: string | null;
}

@Injectable()
export class TimeOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  // ---------------------------------------------------------------- Types

  async findTypes(): Promise<TimeOffTypeDto[]> {
    const types = await this.prisma.timeOffType.findMany({
      include: { _count: { select: { requests: true, allocations: true } } },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return types.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      unit: t.unit,
      requiresAllocation: t.requiresAllocation,
      requiresApproval: t.requiresApproval,
      paid: t.paid,
      colorHex: t.colorHex,
      maxDaysPerRequest: t.maxDaysPerRequest,
      active: t.active,
      requestCount: t._count.requests,
      allocationCount: t._count.allocations,
    }));
  }

  async createType(dto: UpsertTimeOffTypeDto): Promise<TimeOffTypeDto> {
    const created = await this.prisma.timeOffType.create({
      data: { ...dto, code: dto.code.toUpperCase() },
    });
    return this.findTypeById(created.id);
  }

  async updateType(id: string, dto: UpsertTimeOffTypeDto): Promise<TimeOffTypeDto> {
    await this.prisma.timeOffType.update({
      where: { id },
      data: { ...dto, code: dto.code.toUpperCase() },
    });
    return this.findTypeById(id);
  }

  private async findTypeById(id: string): Promise<TimeOffTypeDto> {
    const types = await this.findTypes();
    const found = types.find((t) => t.id === id);
    if (!found) throw new NotFoundException('Time off type not found.');
    return found;
  }

  async removeType(id: string): Promise<{ deleted: boolean; archived: boolean }> {
    const inUse = await this.prisma.leaveRequest.count({ where: { typeId: id } });

    // Types with history are archived so existing requests keep their label.
    if (inUse > 0) {
      await this.prisma.timeOffType.update({ where: { id }, data: { active: false } });
      return { deleted: false, archived: true };
    }
    await this.prisma.timeOffType.delete({ where: { id } });
    return { deleted: true, archived: false };
  }

  // ---------------------------------------------------------------- Balances

  /**
   * Balance is derived, never stored: approved allocations valid on the date,
   * minus approved requests. Pending requests are reported separately so an
   * employee can see what is still awaiting a decision.
   */
  async getBalances(employeeId: string, onDate = new Date()): Promise<LeaveBalanceDto[]> {
    const [types, allocations, requests] = await Promise.all([
      this.prisma.timeOffType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      this.prisma.leaveAllocation.findMany({
        where: {
          employeeId,
          status: 'APPROVED',
          validFrom: { lte: onDate },
          OR: [{ validTo: null }, { validTo: { gte: onDate } }],
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId, status: { in: ['APPROVED', 'TO_APPROVE'] } },
      }),
    ]);

    return types.map((type) => {
      const allocated = allocations
        .filter((a) => a.typeId === type.id)
        .reduce((s, a) => s + toNumber(a.quantity), 0);

      const taken = requests
        .filter((r) => r.typeId === type.id && r.status === 'APPROVED')
        .reduce((s, r) => s + toNumber(r.duration), 0);

      const pending = requests
        .filter((r) => r.typeId === type.id && r.status === 'TO_APPROVE')
        .reduce((s, r) => s + toNumber(r.duration), 0);

      return {
        typeId: type.id,
        typeName: type.name,
        typeCode: type.code,
        unit: type.unit,
        colorHex: type.colorHex,
        requiresAllocation: type.requiresAllocation,
        allocated: round2(allocated),
        taken: round2(taken),
        pending: round2(pending),
        remaining: round2(allocated - taken),
      };
    });
  }

  /** The allocation an approval should draw from: valid, approved, soonest to expire. */
  private async findConsumableAllocation(employeeId: string, typeId: string, onDate: Date) {
    const allocations = await this.prisma.leaveAllocation.findMany({
      where: {
        employeeId,
        typeId,
        status: 'APPROVED',
        validFrom: { lte: onDate },
        OR: [{ validTo: null }, { validTo: { gte: onDate } }],
      },
      orderBy: [{ validTo: 'asc' }, { validFrom: 'asc' }],
    });
    return allocations[0] ?? null;
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

  /**
   * Pre-flight checks run before a request is created or approved: overlapping
   * leave, exhausted balance for allocation-backed types, and per-request caps.
   */
  async validateRequest(params: {
    employeeId: string;
    typeId: string;
    dateFrom: Date;
    dateTo: Date;
    duration: number;
    excludeRequestId?: string;
  }): Promise<LeaveValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const type = await this.prisma.timeOffType.findUnique({ where: { id: params.typeId } });
    if (!type) return { ok: false, errors: ['Time off type not found.'], warnings };

    if (params.dateTo < params.dateFrom) {
      errors.push('End date cannot be before the start date.');
    }
    if (params.duration <= 0) {
      errors.push('The selected range contains no scheduled working days.');
    }
    if (type.maxDaysPerRequest && params.duration > type.maxDaysPerRequest) {
      errors.push(
        `${type.name} allows at most ${type.maxDaysPerRequest} ${type.unit.toLowerCase()}(s) per request.`
      );
    }

    const overlapping = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: params.employeeId,
        status: { in: ['TO_APPROVE', 'APPROVED'] },
        ...(params.excludeRequestId ? { id: { not: params.excludeRequestId } } : {}),
        dateFrom: { lte: params.dateTo },
        dateTo: { gte: params.dateFrom },
      },
      include: { type: true },
    });
    if (overlapping.length > 0) {
      errors.push(`Overlaps an existing ${overlapping[0].type.name} request for the same dates.`);
    }

    let allocationId: string | null = null;
    if (type.requiresAllocation) {
      const balances = await this.getBalances(params.employeeId, params.dateFrom);
      const balance = balances.find((b) => b.typeId === params.typeId);

      if (!balance || balance.allocated === 0) {
        // Distinguish "never allocated" from "allocated but not valid on these
        // dates", which is otherwise confusing for a future-dated request.
        const anyAllocation = await this.prisma.leaveAllocation.findFirst({
          where: { employeeId: params.employeeId, typeId: params.typeId, status: 'APPROVED' },
        });
        errors.push(
          anyAllocation
            ? `No ${type.name} allocation is valid on the requested dates; the existing allocation covers a different period.`
            : `No approved ${type.name} allocation exists for this employee.`
        );
      } else if (balance.remaining < params.duration) {
        errors.push(
          `Insufficient ${type.name} balance: ${balance.remaining} remaining, ${params.duration} requested.`
        );
      } else if (balance.remaining - params.duration < 1) {
        warnings.push(`This will nearly exhaust the ${type.name} balance.`);
      }

      const allocation = await this.findConsumableAllocation(
        params.employeeId,
        params.typeId,
        params.dateFrom
      );
      allocationId = allocation?.id ?? null;
    }

    return { ok: errors.length === 0, errors, warnings, allocationId };
  }

  /** Approved leave overlapping a payroll period, split by paid and unpaid. */
  async approvedLeaveDaysInPeriod(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ total: number; paid: number; unpaid: number }> {
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        dateFrom: { lte: periodEnd },
        dateTo: { gte: periodStart },
      },
      include: { type: true },
    });

    let paid = 0;
    let unpaid = 0;

    for (const r of requests) {
      // Count only the portion of the request that falls inside the period.
      const from = r.dateFrom < periodStart ? periodStart : r.dateFrom;
      const to = r.dateTo > periodEnd ? periodEnd : r.dateTo;
      const fullSpan = eachDay(r.dateFrom, r.dateTo).length || 1;
      const inPeriod = eachDay(from, to).length;
      const portion = round2(toNumber(r.duration) * (inPeriod / fullSpan));

      if (r.type.paid) paid += portion;
      else unpaid += portion;
    }

    return { total: round2(paid + unpaid), paid: round2(paid), unpaid: round2(unpaid) };
  }

  // ---------------------------------------------------------------- Allocations

  private allocationToDto(
    a: Prisma.LeaveAllocationGetPayload<{
      include: {
        employee: { include: { department: true } };
        type: true;
        requests: { select: { duration: true; status: true } };
      };
    }>
  ): LeaveAllocationDto {
    const quantity = toNumber(a.quantity);
    const taken = round2(
      a.requests
        .filter((r) => r.status === 'APPROVED')
        .reduce((s, r) => s + toNumber(r.duration), 0)
    );

    return {
      id: a.id,
      employeeId: a.employeeId,
      employee: {
        id: a.employee.id,
        fullName: `${a.employee.firstName} ${a.employee.lastName}`,
        department: a.employee.department?.name ?? null,
      },
      typeId: a.typeId,
      type: { id: a.type.id, name: a.type.name, unit: a.type.unit, colorHex: a.type.colorHex },
      quantity,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      status: a.status,
      notes: a.notes,
      approvedBy: a.approvedBy,
      approvedAt: a.approvedAt?.toISOString() ?? null,
      taken,
      remaining: round2(quantity - taken),
    };
  }

  async findAllocations(
    query: QueryAllocationsDto,
    user: AuthenticatedUser
  ): Promise<LeaveAllocationDto[]> {
    const scoped =
      user.role === 'EMPLOYEE' ? { employeeId: user.employeeId ?? NO_MATCH_ID } : {};

    const allocations = await this.prisma.leaveAllocation.findMany({
      where: {
        ...scoped,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.typeId ? { typeId: query.typeId } : {}),
      },
      include: {
        employee: { include: { department: true } },
        type: true,
        requests: { select: { duration: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return allocations.map((a) => this.allocationToDto(a));
  }

  async findAllocation(id: string, user: AuthenticatedUser): Promise<LeaveAllocationDto> {
    const allocation = await this.prisma.leaveAllocation.findUnique({
      where: { id },
      include: {
        employee: { include: { department: true } },
        type: true,
        requests: { select: { duration: true, status: true } },
      },
    });
    if (!allocation) throw new NotFoundException('Allocation not found.');

    if (user.role === 'EMPLOYEE' && allocation.employeeId !== user.employeeId) {
      throw new NotFoundException('Allocation not found.');
    }
    return this.allocationToDto(allocation);
  }

  async createAllocation(dto: CreateAllocationDto): Promise<LeaveAllocationDto> {
    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : null;

    if (validTo && validTo < validFrom) {
      throw new BadRequestException('Valid-to date cannot be before the valid-from date.');
    }

    const created = await this.prisma.leaveAllocation.create({
      data: {
        employeeId: dto.employeeId,
        typeId: dto.typeId,
        quantity: toDecimal(dto.quantity),
        validFrom,
        validTo,
        status: dto.status ?? 'DRAFT',
        notes: dto.notes ?? null,
        ...(dto.status === 'APPROVED' ? { approvedAt: new Date() } : {}),
      },
    });

    return this.findAllocationRaw(created.id);
  }

  async updateAllocation(id: string, dto: UpdateAllocationDto): Promise<LeaveAllocationDto> {
    const existing = await this.prisma.leaveAllocation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Allocation not found.');

    // Reducing an allocation below what is already approved would create a
    // negative balance.
    if (dto.quantity !== undefined) {
      const consumed = await this.prisma.leaveRequest.aggregate({
        where: { allocationId: id, status: 'APPROVED' },
        _sum: { duration: true },
      });
      const used = toNumber(consumed._sum.duration);
      if (dto.quantity < used) {
        throw new BadRequestException(
          `${used} day(s) are already approved against this allocation.`
        );
      }
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : existing.validFrom;
    const validTo =
      dto.validTo !== undefined ? (dto.validTo ? new Date(dto.validTo) : null) : existing.validTo;

    if (validTo && validTo < validFrom) {
      throw new BadRequestException('Valid-to date cannot be before the valid-from date.');
    }

    await this.prisma.leaveAllocation.update({
      where: { id },
      data: {
        ...(dto.typeId !== undefined ? { typeId: dto.typeId } : {}),
        ...(dto.quantity !== undefined ? { quantity: toDecimal(dto.quantity) } : {}),
        ...(dto.validFrom !== undefined ? { validFrom } : {}),
        ...(dto.validTo !== undefined ? { validTo } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status === 'APPROVED' ? { approvedAt: new Date() } : {}),
      },
    });

    return this.findAllocationRaw(id);
  }

  private async findAllocationRaw(id: string): Promise<LeaveAllocationDto> {
    const allocation = await this.prisma.leaveAllocation.findUniqueOrThrow({
      where: { id },
      include: {
        employee: { include: { department: true } },
        type: true,
        requests: { select: { duration: true, status: true } },
      },
    });
    return this.allocationToDto(allocation);
  }

  async approveAllocation(id: string, user: AuthenticatedUser): Promise<LeaveAllocationDto> {
    const approved = await this.prisma.leaveAllocation.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: user.name, approvedAt: new Date() },
      include: { type: true },
    });

    await this.notifications.notifyEmployees([approved.employeeId], {
      type: 'allocation.approved',
      title: `Your ${approved.type.name} allocation was approved`,
      body: `${toNumber(approved.quantity)} ${approved.type.unit.toLowerCase()}(s) from ${day(approved.validFrom)}`,
      href: '/time-off',
      actorName: user.name,
      actorId: user.userId,
    });

    return this.findAllocationRaw(id);
  }

  async refuseAllocation(id: string): Promise<LeaveAllocationDto> {
    await this.prisma.leaveAllocation.update({ where: { id }, data: { status: 'REFUSED' } });
    return this.findAllocationRaw(id);
  }

  async removeAllocation(id: string): Promise<{ deleted: true }> {
    const consumed = await this.prisma.leaveRequest.count({
      where: { allocationId: id, status: 'APPROVED' },
    });
    if (consumed > 0) {
      throw new BadRequestException('Approved leave has already consumed this allocation.');
    }

    await this.prisma.leaveAllocation.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- Requests

  private requestToDto(
    r: Prisma.LeaveRequestGetPayload<{
      include: { employee: { include: { department: true } }; type: true };
    }>
  ): LeaveRequestDto {
    return {
      id: r.id,
      employeeId: r.employeeId,
      employee: {
        id: r.employee.id,
        fullName: `${r.employee.firstName} ${r.employee.lastName}`,
        department: r.employee.department?.name ?? null,
      },
      typeId: r.typeId,
      type: {
        id: r.type.id,
        name: r.type.name,
        unit: r.type.unit,
        colorHex: r.type.colorHex,
        paid: r.type.paid,
        requiresAllocation: r.type.requiresAllocation,
      },
      allocationId: r.allocationId,
      dateFrom: r.dateFrom.toISOString(),
      dateTo: r.dateTo.toISOString(),
      duration: toNumber(r.duration),
      status: r.status,
      reason: r.reason,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      refusedBy: r.refusedBy,
      refusedAt: r.refusedAt?.toISOString() ?? null,
      refuseReason: r.refuseReason,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async findRequests(
    query: QueryLeaveRequestsDto,
    user: AuthenticatedUser
  ): Promise<LeaveRequestDto[]> {
    const scoped =
      user.role === 'EMPLOYEE' ? { employeeId: user.employeeId ?? NO_MATCH_ID } : {};

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        ...scoped,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.typeId ? { typeId: query.typeId } : {}),
        ...(query.q
          ? {
              OR: [
                { employee: { firstName: { contains: query.q, mode: 'insensitive' as const } } },
                { employee: { lastName: { contains: query.q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: { employee: { include: { department: true } }, type: true },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 300,
    });

    return requests.map((r) => this.requestToDto(r));
  }

  async findRequest(id: string, user: AuthenticatedUser): Promise<LeaveRequestDto> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { include: { department: true } }, type: true },
    });
    if (!request) throw new NotFoundException('Request not found.');

    if (user.role === 'EMPLOYEE' && request.employeeId !== user.employeeId) {
      throw new NotFoundException('Request not found.');
    }
    return this.requestToDto(request);
  }

  async createRequest(
    dto: CreateLeaveRequestDto,
    user: AuthenticatedUser
  ): Promise<LeaveRequestDto> {
    const employeeId = user.role === 'EMPLOYEE' ? user.employeeId : dto.employeeId;
    if (!employeeId) throw new BadRequestException('Employee is required.');

    if (user.role === 'EMPLOYEE' && dto.employeeId && dto.employeeId !== user.employeeId) {
      throw new ForbiddenException('You can only file your own time off requests.');
    }

    const type = await this.prisma.timeOffType.findUnique({ where: { id: dto.typeId } });
    if (!type) throw new NotFoundException('Time off type not found.');

    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);
    const lines = await this.scheduleLinesFor(employeeId);

    // Duration always counts scheduled working days, never raw calendar days.
    const duration = computeLeaveDuration(dateFrom, dateTo, lines, type.unit);

    const validation = await this.validateRequest({
      employeeId,
      typeId: dto.typeId,
      dateFrom,
      dateTo,
      duration,
    });
    if (!validation.ok) throw new BadRequestException(validation.errors.join(' '));

    const autoApprove = !type.requiresApproval;

    const created = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        typeId: dto.typeId,
        dateFrom,
        dateTo,
        duration: toDecimal(duration),
        reason: dto.reason ?? null,
        status: autoApprove ? 'APPROVED' : 'TO_APPROVE',
        ...(autoApprove
          ? {
              approvedBy: 'Auto',
              approvedAt: new Date(),
              ...(type.requiresAllocation ? { allocationId: validation.allocationId } : {}),
            }
          : {}),
      },
      include: { employee: { include: { department: true } }, type: true },
    });

    // A request that approved itself has nothing for an approver to look at.
    if (created.status === 'TO_APPROVE') {
      await this.notifications.notifyPermission('timeOffRequests', 'approve', {
        type: 'leave.filed',
        title: `${created.employee.firstName} ${created.employee.lastName} requested ${created.type.name}`,
        body: `${day(created.dateFrom)} to ${day(created.dateTo)}, ${toNumber(created.duration)} ${created.type.unit.toLowerCase()}(s)`,
        href: '/time-off',
        actorName: user.name,
        actorId: user.userId,
      });
    }

    return this.requestToDto(created);
  }

  async updateRequest(
    id: string,
    dto: UpdateLeaveRequestDto,
    user: AuthenticatedUser
  ): Promise<LeaveRequestDto> {
    const existing = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { type: true },
    });
    if (!existing) throw new NotFoundException('Request not found.');

    if (user.role === 'EMPLOYEE') {
      if (existing.employeeId !== user.employeeId) {
        throw new ForbiddenException('You can only edit your own requests.');
      }
      if (existing.status === 'APPROVED') {
        throw new BadRequestException('An approved request can no longer be edited.');
      }
    }

    const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : existing.dateFrom;
    const dateTo = dto.dateTo ? new Date(dto.dateTo) : existing.dateTo;
    const typeId = dto.typeId ?? existing.typeId;

    const type = await this.prisma.timeOffType.findUniqueOrThrow({ where: { id: typeId } });
    const lines = await this.scheduleLinesFor(existing.employeeId);
    const duration = computeLeaveDuration(dateFrom, dateTo, lines, type.unit);

    const validation = await this.validateRequest({
      employeeId: existing.employeeId,
      typeId,
      dateFrom,
      dateTo,
      duration,
      excludeRequestId: id,
    });
    if (!validation.ok) throw new BadRequestException(validation.errors.join(' '));

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        typeId,
        dateFrom,
        dateTo,
        duration: toDecimal(duration),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      },
      include: { employee: { include: { department: true } }, type: true },
    });

    return this.requestToDto(updated);
  }

  /**
   * Approving links the request to a consumable allocation so the balance is
   * visibly drawn down rather than merely inferred.
   */
  async approveRequest(id: string, user: AuthenticatedUser): Promise<LeaveRequestDto> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { type: true },
    });
    if (!request) throw new NotFoundException('Request not found.');

    const validation = await this.validateRequest({
      employeeId: request.employeeId,
      typeId: request.typeId,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      duration: toNumber(request.duration),
      excludeRequestId: id,
    });
    if (!validation.ok) throw new BadRequestException(validation.errors.join(' '));

    let allocationId = request.allocationId;
    if (request.type.requiresAllocation && !allocationId) {
      const allocation = await this.findConsumableAllocation(
        request.employeeId,
        request.typeId,
        request.dateFrom
      );
      if (!allocation) {
        throw new BadRequestException('No approved allocation is available to consume.');
      }
      allocationId = allocation.id;
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        allocationId,
        approvedBy: user.name,
        approvedAt: new Date(),
        refusedBy: null,
        refusedAt: null,
        refuseReason: null,
      },
      include: { employee: { include: { department: true } }, type: true },
    });

    await this.notifications.notifyEmployees([updated.employeeId], {
      type: 'leave.approved',
      title: `Your ${updated.type.name} request was approved`,
      body: `${day(updated.dateFrom)} to ${day(updated.dateTo)}`,
      href: '/time-off',
      actorName: user.name,
      actorId: user.userId,
    });

    return this.requestToDto(updated);
  }

  async refuseRequest(
    id: string,
    dto: RefuseRequestDto,
    user: AuthenticatedUser
  ): Promise<LeaveRequestDto> {
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REFUSED',
        // Release the allocation so the balance returns to the employee.
        allocationId: null,
        refusedBy: user.name,
        refusedAt: new Date(),
        refuseReason: dto.reason ?? 'No reason provided.',
        approvedBy: null,
        approvedAt: null,
      },
      include: { employee: { include: { department: true } }, type: true },
    });

    await this.notifications.notifyEmployees([updated.employeeId], {
      type: 'leave.refused',
      title: `Your ${updated.type.name} request was refused`,
      body: updated.refuseReason,
      href: '/time-off',
      actorName: user.name,
      actorId: user.userId,
    });

    return this.requestToDto(updated);
  }

  async cancelRequest(id: string, user: AuthenticatedUser): Promise<LeaveRequestDto> {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found.');

    if (user.role === 'EMPLOYEE' && request.employeeId !== user.employeeId) {
      throw new ForbiddenException('You can only cancel your own requests.');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED', allocationId: null },
      include: { employee: { include: { department: true } }, type: true },
    });
    return this.requestToDto(updated);
  }

  async removeRequest(id: string): Promise<{ deleted: true }> {
    await this.prisma.leaveRequest.delete({ where: { id } });
    return { deleted: true };
  }
}

/** Date only: a notification line has no use for the time. */
function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}
