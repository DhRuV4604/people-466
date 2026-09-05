import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveContractForPeriod, rangesOverlap, type ContractDto } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { pageArgs, paginated } from '../../common/pagination';
import { toNumber, toDecimal } from '../../common/decimal';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateContractDto, UpdateContractDto, QueryContractsDto } from './dto/contract.dto';
import { NO_MATCH_ID } from '../../common/scoping';
import type { Paginated } from '@peoplepay360/shared';

const CONTRACT_INCLUDE = {
  employee: { include: { department: true } },
  jobPosition: true,
  workingSchedule: true,
  salaryStructure: true,
} satisfies Prisma.ContractInclude;

type ContractWithRelations = Prisma.ContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>;

/** Relations payroll computation needs when resolving the period contract. */
const PAYROLL_CONTRACT_INCLUDE = {
  salaryStructure: true,
  workingSchedule: { include: { lines: true } },
  jobPosition: true,
} satisfies Prisma.ContractInclude;

export type ContractForPayroll = Prisma.ContractGetPayload<{
  include: typeof PAYROLL_CONTRACT_INCLUDE;
}>;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(c: ContractWithRelations, isApplicable?: boolean): ContractDto {
    return {
      id: c.id,
      name: c.name,
      employeeId: c.employeeId,
      employee: {
        id: c.employee.id,
        fullName: `${c.employee.firstName} ${c.employee.lastName}`,
        department: c.employee.department?.name ?? null,
      },
      dateStart: c.dateStart.toISOString(),
      dateEnd: c.dateEnd?.toISOString() ?? null,
      status: c.status,
      wage: toNumber(c.wage),
      contractType: c.contractType,
      jobPositionId: c.jobPositionId,
      jobPosition: c.jobPosition ? { id: c.jobPosition.id, name: c.jobPosition.name } : null,
      workingScheduleId: c.workingScheduleId,
      workingSchedule: c.workingSchedule
        ? { id: c.workingSchedule.id, name: c.workingSchedule.name }
        : null,
      salaryStructureId: c.salaryStructureId,
      salaryStructure: c.salaryStructure
        ? { id: c.salaryStructure.id, name: c.salaryStructure.name }
        : null,
      notes: c.notes,
      ...(isApplicable !== undefined ? { isApplicableForPeriod: isApplicable } : {}),
    };
  }

  async findAll(
    query: QueryContractsDto,
    user: AuthenticatedUser
  ): Promise<Paginated<ContractDto>> {
    // An employee may only ever see their own contracts.
    const scoped =
      user.role === 'EMPLOYEE' ? { employeeId: user.employeeId ?? NO_MATCH_ID } : {};

    const now = new Date();
    const expiringHorizon = new Date(now.getTime() + 30 * 86400000);

    const where: Prisma.ContractWhereInput = {
      ...scoped,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.expiring
        ? { status: 'RUNNING' as const, dateEnd: { not: null, gte: now, lte: expiringHorizon } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { employee: { firstName: { contains: query.q, mode: 'insensitive' as const } } },
              { employee: { lastName: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const { skip, take, page, pageSize } = pageArgs(query);

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
      where,
      include: CONTRACT_INCLUDE,
      orderBy: { dateStart: 'desc' },
      skip,
      take,
      }),
      this.prisma.contract.count({ where }),
    ]);

    // Flag which contract actually governs the reference period, per employee.
    // Resolved across this page only: the flag answers "of the contracts you
    // are looking at, which one applies", and a page is what you are looking at.
    const periodStart = query.periodStart
      ? new Date(query.periodStart)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = query.periodEnd
      ? new Date(query.periodEnd)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const byEmployee = new Map<string, ContractWithRelations[]>();
    for (const c of contracts) {
      const list = byEmployee.get(c.employeeId) ?? [];
      list.push(c);
      byEmployee.set(c.employeeId, list);
    }

    const applicableIds = new Set<string>();
    for (const list of byEmployee.values()) {
      const applicable = resolveContractForPeriod(list, periodStart, periodEnd);
      if (applicable) applicableIds.add(applicable.id);
    }

    return paginated(
      contracts.map((c) => this.toDto(c, applicableIds.has(c.id))),
      total,
      page,
      pageSize
    );
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<ContractDto> {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
    if (!contract) throw new NotFoundException('Contract not found.');

    if (user.role === 'EMPLOYEE' && contract.employeeId !== user.employeeId) {
      throw new NotFoundException('Contract not found.');
    }
    return this.toDto(contract);
  }

  /**
   * Guard the "no concurrent active contracts" rule. Only RUNNING contracts can
   * conflict; drafts and expired records may overlap freely.
   */
  private async assertNoOverlap(params: {
    employeeId: string;
    dateStart: Date;
    dateEnd: Date | null;
    status: string;
    excludeId?: string;
  }): Promise<void> {
    if (params.status !== 'RUNNING') return;

    const existing = await this.prisma.contract.findMany({
      where: {
        employeeId: params.employeeId,
        status: 'RUNNING',
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      },
    });

    const clash = existing.find((c) =>
      rangesOverlap(c.dateStart, c.dateEnd, params.dateStart, params.dateEnd)
    );

    if (clash) {
      const end = clash.dateEnd ? clash.dateEnd.toISOString().slice(0, 10) : 'open ended';
      throw new BadRequestException(
        `This overlaps a running contract (${clash.dateStart.toISOString().slice(0, 10)} to ${end}). Close it first, or change these dates.`
      );
    }
  }

  async create(dto: CreateContractDto): Promise<ContractDto> {
    const dateStart = new Date(dto.dateStart);
    const dateEnd = dto.dateEnd ? new Date(dto.dateEnd) : null;

    if (dateEnd && dateEnd < dateStart) {
      throw new BadRequestException('End date cannot be before the start date.');
    }

    await this.assertNoOverlap({
      employeeId: dto.employeeId,
      dateStart,
      dateEnd,
      status: dto.status ?? 'DRAFT',
    });

    const contract = await this.prisma.contract.create({
      data: {
        name: dto.name,
        employeeId: dto.employeeId,
        dateStart,
        dateEnd,
        status: dto.status ?? 'DRAFT',
        wage: toDecimal(dto.wage),
        contractType: dto.contractType ?? 'PERMANENT',
        jobPositionId: dto.jobPositionId ?? null,
        workingScheduleId: dto.workingScheduleId ?? null,
        salaryStructureId: dto.salaryStructureId ?? null,
        notes: dto.notes ?? null,
      },
      include: CONTRACT_INCLUDE,
    });

    return this.toDto(contract);
  }

  async update(id: string, dto: UpdateContractDto): Promise<ContractDto> {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contract not found.');

    const dateStart = dto.dateStart ? new Date(dto.dateStart) : existing.dateStart;
    const dateEnd =
      dto.dateEnd !== undefined ? (dto.dateEnd ? new Date(dto.dateEnd) : null) : existing.dateEnd;

    if (dateEnd && dateEnd < dateStart) {
      throw new BadRequestException('End date cannot be before the start date.');
    }

    await this.assertNoOverlap({
      employeeId: existing.employeeId,
      dateStart,
      dateEnd,
      status: dto.status ?? existing.status,
      excludeId: id,
    });

    const contract = await this.prisma.contract.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.dateStart !== undefined ? { dateStart } : {}),
        ...(dto.dateEnd !== undefined ? { dateEnd } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.wage !== undefined ? { wage: toDecimal(dto.wage) } : {}),
        ...(dto.contractType !== undefined ? { contractType: dto.contractType } : {}),
        ...(dto.jobPositionId !== undefined ? { jobPositionId: dto.jobPositionId } : {}),
        ...(dto.workingScheduleId !== undefined
          ? { workingScheduleId: dto.workingScheduleId }
          : {}),
        ...(dto.salaryStructureId !== undefined
          ? { salaryStructureId: dto.salaryStructureId }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: CONTRACT_INCLUDE,
    });

    return this.toDto(contract);
  }

  async remove(id: string): Promise<{ deleted: boolean; archived: boolean }> {
    const payslipCount = await this.prisma.payslip.count({ where: { contractId: id } });

    // A contract referenced by payslips is historical evidence; cancel it instead.
    if (payslipCount > 0) {
      await this.prisma.contract.update({ where: { id }, data: { status: 'CANCELLED' } });
      return { deleted: false, archived: true };
    }

    await this.prisma.contract.delete({ where: { id } });
    return { deleted: true, archived: false };
  }

  /** Resolve the single contract governing a period, for payroll computation. */
  async getContractForPeriod(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ContractForPayroll | null> {
    const contracts = await this.prisma.contract.findMany({
      where: { employeeId },
      include: PAYROLL_CONTRACT_INCLUDE,
      orderBy: { dateStart: 'desc' },
    });

    return resolveContractForPeriod(contracts, periodStart, periodEnd);
  }
}
