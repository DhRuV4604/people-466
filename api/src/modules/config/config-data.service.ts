import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  computeWeeklyHours,
  type WorkingScheduleDto,
  type DepartmentDto,
  type JobPositionDto,
  type ScheduleLineInput,
  type Paginated,
} from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  pageArgs,
  paginated,
  type PaginationQueryDto,
} from '../../common/pagination';
import { toNumber, toDecimal } from '../../common/decimal';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  UpsertScheduleDto,
  UpsertDepartmentDto,
  UpsertPositionDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/config.dto';

@Injectable()
export class ConfigDataService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- Schedules

  private scheduleToDto(s: {
    id: string;
    name: string;
    scheduleType: string;
    timezone: string;
    hoursPerWeek: unknown;
    active: boolean;
    lines: { id: string; dayOfWeek: number; startTime: string; endTime: string; breakHours: unknown }[];
    _count?: { employees: number; contracts: number };
  }): WorkingScheduleDto {
    return {
      id: s.id,
      name: s.name,
      scheduleType: s.scheduleType as WorkingScheduleDto['scheduleType'],
      timezone: s.timezone,
      hoursPerWeek: toNumber(s.hoursPerWeek as never),
      active: s.active,
      lines: s.lines.map((l) => ({
        id: l.id,
        dayOfWeek: l.dayOfWeek,
        startTime: l.startTime,
        endTime: l.endTime,
        breakHours: toNumber(l.breakHours as never),
      })),
      employeeCount: s._count?.employees,
      contractCount: s._count?.contracts,
    };
  }

  async findSchedules(
    query: PaginationQueryDto = {}
  ): Promise<Paginated<WorkingScheduleDto>> {
    const { skip, take, page, pageSize } = pageArgs(query);

    const [schedules, total] = await this.prisma.$transaction([
      this.prisma.workingSchedule.findMany({
        include: {
          lines: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
          _count: { select: { employees: true, contracts: true } },
        },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip,
        take,
      }),
      this.prisma.workingSchedule.count(),
    ]);

    return paginated(
      schedules.map((s) => this.scheduleToDto(s)),
      total,
      page,
      pageSize
    );
  }

  async findSchedule(id: string): Promise<WorkingScheduleDto> {
    const schedule = await this.prisma.workingSchedule.findUnique({
      where: { id },
      include: {
        lines: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        _count: { select: { employees: true, contracts: true } },
      },
    });
    if (!schedule) throw new NotFoundException('Working schedule not found.');
    return this.scheduleToDto(schedule);
  }

  async createSchedule(dto: UpsertScheduleDto): Promise<WorkingScheduleDto> {
    const lines = this.validateLines(dto.lines);
    // Weekly hours are always derived, never taken from the request body.
    const hoursPerWeek = computeWeeklyHours(lines);

    const created = await this.prisma.workingSchedule.create({
      data: {
        name: dto.name,
        scheduleType: dto.scheduleType ?? 'FULL_TIME',
        timezone: dto.timezone ?? 'UTC',
        hoursPerWeek: toDecimal(hoursPerWeek),
        active: dto.active ?? true,
        lines: {
          create: lines.map((l) => ({
            dayOfWeek: l.dayOfWeek,
            startTime: l.startTime,
            endTime: l.endTime,
            breakHours: toDecimal(l.breakHours),
          })),
        },
      },
    });

    return this.findSchedule(created.id);
  }

  async updateSchedule(id: string, dto: UpsertScheduleDto): Promise<WorkingScheduleDto> {
    const lines = this.validateLines(dto.lines);
    const hoursPerWeek = computeWeeklyHours(lines);

    // Replace the whole pattern so removed rows actually disappear.
    await this.prisma.$transaction([
      this.prisma.workingScheduleLine.deleteMany({ where: { scheduleId: id } }),
      this.prisma.workingSchedule.update({
        where: { id },
        data: {
          name: dto.name,
          scheduleType: dto.scheduleType ?? 'FULL_TIME',
          timezone: dto.timezone ?? 'UTC',
          hoursPerWeek: toDecimal(hoursPerWeek),
          active: dto.active ?? true,
          lines: {
            create: lines.map((l) => ({
              dayOfWeek: l.dayOfWeek,
              startTime: l.startTime,
              endTime: l.endTime,
              breakHours: toDecimal(l.breakHours),
            })),
          },
        },
      }),
    ]);

    return this.findSchedule(id);
  }

  private validateLines(lines: UpsertScheduleDto['lines']): ScheduleLineInput[] {
    if (!lines || lines.length === 0) {
      throw new BadRequestException('Add at least one working day with a start and end time.');
    }
    return lines.map((l) => ({
      dayOfWeek: l.dayOfWeek,
      startTime: l.startTime,
      endTime: l.endTime,
      breakHours: l.breakHours ?? 0,
    }));
  }

  async removeSchedule(id: string): Promise<{ deleted: true }> {
    const [employees, contracts] = await Promise.all([
      this.prisma.employee.count({ where: { workingScheduleId: id } }),
      this.prisma.contract.count({ where: { workingScheduleId: id } }),
    ]);

    const inUse = employees + contracts;
    if (inUse > 0) {
      throw new BadRequestException(
        `${inUse} employee(s) or contract(s) still use this schedule.`
      );
    }

    await this.prisma.workingSchedule.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- Departments

  async findDepartments(
    query: PaginationQueryDto = {}
  ): Promise<Paginated<DepartmentDto>> {
    const { skip, take, page, pageSize } = pageArgs(query);

    const [departments, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        include: { _count: { select: { employees: true } } },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.department.count(),
    ]);

    return paginated(
      departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        employeeCount: d._count.employees,
      })),
      total,
      page,
      pageSize
    );
  }

  async createDepartment(dto: UpsertDepartmentDto): Promise<DepartmentDto> {
    const created = await this.prisma.department.create({ data: dto });
    return { id: created.id, name: created.name, code: created.code, employeeCount: 0 };
  }

  async updateDepartment(id: string, dto: UpsertDepartmentDto): Promise<DepartmentDto> {
    const updated = await this.prisma.department.update({
      where: { id },
      data: dto,
      include: { _count: { select: { employees: true } } },
    });
    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      employeeCount: updated._count.employees,
    };
  }

  async removeDepartment(id: string): Promise<{ deleted: true }> {
    const count = await this.prisma.employee.count({ where: { departmentId: id } });
    if (count > 0) {
      throw new BadRequestException(
        `${count} employee(s) are still assigned to this department.`
      );
    }
    await this.prisma.department.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- Positions

  async findPositions(
    query: PaginationQueryDto = {}
  ): Promise<Paginated<JobPositionDto>> {
    const { skip, take, page, pageSize } = pageArgs(query);

    const [positions, total] = await this.prisma.$transaction([
      this.prisma.jobPosition.findMany({
        include: { _count: { select: { employees: true } } },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.jobPosition.count(),
    ]);

    return paginated(
      positions.map((p) => ({
        id: p.id,
        name: p.name,
        employeeCount: p._count.employees,
      })),
      total,
      page,
      pageSize
    );
  }

  async createPosition(dto: UpsertPositionDto): Promise<JobPositionDto> {
    const created = await this.prisma.jobPosition.create({ data: dto });
    return { id: created.id, name: created.name, employeeCount: 0 };
  }

  async updatePosition(id: string, dto: UpsertPositionDto): Promise<JobPositionDto> {
    const updated = await this.prisma.jobPosition.update({
      where: { id },
      data: dto,
      include: { _count: { select: { employees: true } } },
    });
    return { id: updated.id, name: updated.name, employeeCount: updated._count.employees };
  }

  async removePosition(id: string): Promise<{ deleted: true }> {
    const count = await this.prisma.employee.count({ where: { jobPositionId: id } });
    if (count > 0) {
      throw new BadRequestException(`${count} employee(s) still hold this position.`);
    }
    await this.prisma.jobPosition.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- Users

  /**
   * One user by id, for returning the row a write just produced. Searching a
   * page of findUsers would only find it while it happened to be on page one.
   */
  private async userById(id: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      employeeId: u.employee?.id ?? null,
      employeeName: u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : null,
    };
  }

  async findUsers(query: PaginationQueryDto = {}) {
    const { skip, take, page, pageSize } = pageArgs(query);

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        skip,
        take,
      }),
      this.prisma.user.count(),
    ]);

    const items = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      employeeId: u.employee?.id ?? null,
      employeeName: u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : null,
    }));

    return paginated(items, total, page, pageSize);
  }

  async createUser(dto: CreateUserDto) {
    const created = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        role: dto.role,
        active: dto.active ?? true,
        passwordHash: await AuthService.hashPassword(dto.password),
      },
    });

    if (dto.employeeId) {
      await this.prisma.employee.update({
        where: { id: dto.employeeId },
        data: { userId: created.id },
      });
    }

    return this.userById(created.id);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.password ? { passwordHash: await AuthService.hashPassword(dto.password) } : {}),
      },
    });

    // Re-point the employee link, clearing any previous one first.
    if (dto.employeeId !== undefined) {
      await this.prisma.employee.updateMany({ where: { userId: id }, data: { userId: null } });
      if (dto.employeeId) {
        await this.prisma.employee.update({
          where: { id: dto.employeeId },
          data: { userId: id },
        });
      }
    }

    return this.userById(id);
  }

  async removeUser(id: string, actor: AuthenticatedUser): Promise<{ deleted: true }> {
    if (actor.userId === id) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    await this.prisma.employee.updateMany({ where: { userId: id }, data: { userId: null } });
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
