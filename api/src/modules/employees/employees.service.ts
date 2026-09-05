import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scopeToOwnRecords } from '@peoplepay360/shared';
import type {
  EmployeeSummaryDto,
  EmployeeDetailDto,
  EmployeeOptionDto,
  Paginated,
} from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { pageArgs, paginated } from '../../common/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateEmployeeDto, UpdateEmployeeDto, QueryEmployeesDto } from './dto/employee.dto';
import { NO_MATCH_ID } from '../../common/scoping';

const SUMMARY_INCLUDE = {
  department: true,
  jobPosition: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
  workingSchedule: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeSummaryRow = Prisma.EmployeeGetPayload<{ include: typeof SUMMARY_INCLUDE }>;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  private toSummary(e: EmployeeSummaryRow): EmployeeSummaryDto {
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      fullName: `${e.firstName} ${e.lastName}`,
      workEmail: e.workEmail,
      employeeType: e.employeeType,
      status: e.status,
      department: e.department ? { id: e.department.id, name: e.department.name } : null,
      jobPosition: e.jobPosition ? { id: e.jobPosition.id, name: e.jobPosition.name } : null,
      manager: e.manager
        ? { id: e.manager.id, fullName: `${e.manager.firstName} ${e.manager.lastName}` }
        : null,
      workingSchedule: e.workingSchedule
        ? { id: e.workingSchedule.id, name: e.workingSchedule.name }
        : null,
      // Bank details are reduced to a boolean here; the raw account number is
      // only exposed on the detail endpoint.
      hasBankDetails: Boolean(e.bankName && e.bankAccountNumber),
      hireDate: e.hireDate.toISOString(),
    };
  }

  async findAll(
    query: QueryEmployeesDto,
    user: AuthenticatedUser
  ): Promise<Paginated<EmployeeSummaryDto>> {
    // An employee may only ever see their own record.
    const scoped = user.role === 'EMPLOYEE' ? { id: user.employeeId ?? NO_MATCH_ID } : {};

    const where: Prisma.EmployeeWhereInput = {
      ...scoped,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.employeeType ? { employeeType: query.employeeType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.missingBank
        ? { OR: [{ bankAccountNumber: null }, { bankName: null }] }
        : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' as const } },
              { lastName: { contains: query.q, mode: 'insensitive' as const } },
              { workEmail: { contains: query.q, mode: 'insensitive' as const } },
              { employeeCode: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const { skip, take, page, pageSize } = pageArgs(query);

    // One round trip: the rows and the count of everything matching the filter,
    // which is what the page numbers are derived from.
    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return paginated(
      employees.map((e) => this.toSummary(e)),
      total,
      page,
      pageSize
    );
  }

  /**
   * The id/label pairs forms need to point a record at an employee.
   *
   * Deliberately not `findAll`: a dropdown needs four columns, not every column
   * of every row plus its department, position, manager and schedule. The same
   * own-records scoping applies, so an Employee still only ever sees itself.
   */
  async findOptions(user: AuthenticatedUser): Promise<EmployeeOptionDto[]> {
    const scoped = user.role === 'EMPLOYEE' ? { id: user.employeeId ?? NO_MATCH_ID } : {};

    const employees = await this.prisma.employee.findMany({
      where: scoped,
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return employees.map((e) => ({
      id: e.id,
      fullName: `${e.firstName} ${e.lastName}`,
      employeeCode: e.employeeCode,
    }));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<EmployeeDetailDto> {
    if (user.role === 'EMPLOYEE' && user.employeeId !== id) {
      throw new NotFoundException('Employee not found.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        ...SUMMARY_INCLUDE,
        _count: {
          select: {
            contracts: true,
            attendances: true,
            leaveRequests: true,
            leaveAllocations: true,
            payslips: true,
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found.');

    return {
      ...this.toSummary(employee),
      workPhone: employee.workPhone,
      dateOfBirth: employee.dateOfBirth?.toISOString() ?? null,
      gender: employee.gender,
      address: employee.address,
      bankName: employee.bankName,
      bankAccountNumber: employee.bankAccountNumber,
      exitDate: employee.exitDate?.toISOString() ?? null,
      departmentId: employee.departmentId,
      jobPositionId: employee.jobPositionId,
      managerId: employee.managerId,
      workingScheduleId: employee.workingScheduleId,
      counts: {
        contracts: employee._count.contracts,
        attendances: employee._count.attendances,
        leaveRequests: employee._count.leaveRequests,
        leaveAllocations: employee._count.leaveAllocations,
        payslips: employee._count.payslips,
      },
    };
  }

  private async nextEmployeeCode(): Promise<string> {
    const last = await this.prisma.employee.findFirst({
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });
    const n = last ? parseInt(last.employeeCode.replace(/\D/g, ''), 10) + 1 : 1;
    return `EMP${String(n).padStart(4, '0')}`;
  }

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser): Promise<EmployeeDetailDto> {
    const created = await this.prisma.employee.create({
      data: {
        employeeCode: await this.nextEmployeeCode(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        workEmail: dto.workEmail.toLowerCase(),
        workPhone: dto.workPhone ?? null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        address: dto.address ?? null,
        bankName: dto.bankName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        employeeType: dto.employeeType ?? 'FULL_TIME',
        status: dto.status ?? 'ACTIVE',
        hireDate: new Date(dto.hireDate),
        departmentId: dto.departmentId ?? null,
        jobPositionId: dto.jobPositionId ?? null,
        managerId: dto.managerId ?? null,
        workingScheduleId: dto.workingScheduleId ?? null,
      },
    });

    // Every role that can read an employee is told, except the Employee role:
    // it only ever sees itself, so a new colleague is not its news.
    await this.notifications.notifyPermission(
      'employees',
      'read',
      {
        type: 'employee.created',
        title: `${created.firstName} ${created.lastName} joined`,
        body: `Employee ${created.employeeCode} was added.`,
        href: `/employees/${created.id}`,
        actorName: user.name,
        actorId: user.userId,
      },
      (role) => !scopeToOwnRecords(role)
    );

    return this.findOne(created.id, user);
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    user: AuthenticatedUser
  ): Promise<EmployeeDetailDto> {
    // A self-referencing manager would create a cycle in the reporting tree.
    if (dto.managerId === id) {
      throw new BadRequestException('An employee cannot be their own manager.');
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.workEmail !== undefined ? { workEmail: dto.workEmail.toLowerCase() } : {}),
        ...(dto.workPhone !== undefined ? { workPhone: dto.workPhone } : {}),
        ...(dto.dateOfBirth !== undefined
          ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }
          : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
        ...(dto.bankAccountNumber !== undefined
          ? { bankAccountNumber: dto.bankAccountNumber }
          : {}),
        ...(dto.employeeType !== undefined ? { employeeType: dto.employeeType } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.hireDate !== undefined ? { hireDate: new Date(dto.hireDate) } : {}),
        ...(dto.exitDate !== undefined
          ? { exitDate: dto.exitDate ? new Date(dto.exitDate) : null }
          : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.jobPositionId !== undefined ? { jobPositionId: dto.jobPositionId } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
        ...(dto.workingScheduleId !== undefined
          ? { workingScheduleId: dto.workingScheduleId }
          : {}),
      },
    });

    return this.findOne(id, user);
  }

  async remove(id: string): Promise<{ deleted: boolean; archived: boolean }> {
    const payslipCount = await this.prisma.payslip.count({ where: { employeeId: id } });

    // Payroll history must not be destroyed; archive the employee instead.
    if (payslipCount > 0) {
      await this.prisma.employee.update({
        where: { id },
        data: { status: 'INACTIVE', exitDate: new Date() },
      });
      return { deleted: false, archived: true };
    }

    await this.prisma.employee.delete({ where: { id } });
    return { deleted: true, archived: false };
  }
}
