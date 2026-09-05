import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  resolveContractForPeriod,
  type PayrunDto,
  type EligibleEmployeeDto,
} from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_PAGE_SIZE, pageArgs, paginated } from '../../common/pagination';
import { toNumber, round2 } from '../../common/decimal';
import { ContractsService } from '../contracts/contracts.service';
import { PayslipsService } from './payslips.service';
import { MailService } from './mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreatePayrunDto, QueryPayrunsDto, EligibilityQueryDto } from './dto/payroll.dto';
import type { Paginated } from '@peoplepay360/shared';

const PAYRUN_INCLUDE = {
  structure: { select: { id: true, name: true } },
  payslips: {
    select: { grossPay: true, totalDeductions: true, netPay: true },
  },
} satisfies Prisma.PayrunInclude;

type PayrunRow = Prisma.PayrunGetPayload<{ include: typeof PAYRUN_INCLUDE }>;

/** Warning prefixes that block validation until resolved. */
const BLOCKING_PREFIXES = [
  'Duplicate payslip',
  'Missing bank details',
  'No applicable contract',
  'Negative net pay',
];

@Injectable()
export class PayrunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: ContractsService,
    private readonly payslips: PayslipsService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService
  ) {}

  private toDto(p: PayrunRow): PayrunDto {
    return {
      id: p.id,
      name: p.name,
      structureId: p.structureId,
      structure: p.structure,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      status: p.status,
      departmentFilter: p.departmentFilter,
      employeeTypeFilter: p.employeeTypeFilter,
      computedAt: p.computedAt?.toISOString() ?? null,
      validatedAt: p.validatedAt?.toISOString() ?? null,
      paidAt: p.paidAt?.toISOString() ?? null,
      paidBy: p.paidBy,
      createdAt: p.createdAt.toISOString(),
      payslipCount: p.payslips.length,
      totalGross: round2(p.payslips.reduce((s, x) => s + toNumber(x.grossPay), 0)),
      totalDeductions: round2(
        p.payslips.reduce((s, x) => s + toNumber(x.totalDeductions), 0)
      ),
      totalNet: round2(p.payslips.reduce((s, x) => s + toNumber(x.netPay), 0)),
    };
  }

  async findAll(query: QueryPayrunsDto): Promise<Paginated<PayrunDto>> {
    // Hoisted so the count applies exactly the same filter as the page.
    const where: Prisma.PayrunWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };

    const { skip, take, page, pageSize } = pageArgs(query);

    const [payruns, total] = await this.prisma.$transaction([
      this.prisma.payrun.findMany({
        where,
        include: PAYRUN_INCLUDE,
        orderBy: { periodStart: 'desc' },
        skip,
        take,
      }),
      this.prisma.payrun.count({ where }),
    ]);
    return paginated(
      payruns.map((p) => this.toDto(p)),
      total,
      page,
      pageSize
    );
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<PayrunDto> {
    const payrun = await this.prisma.payrun.findUnique({
      where: { id },
      include: PAYRUN_INCLUDE,
    });
    if (!payrun) throw new NotFoundException('Pay run not found.');

    const [payslips, warnings] = await Promise.all([
      // A run's own payslips are shown in full rather than a page of them, so
      // this asks for the largest page the API will serve.
      this.payslips.findAll({ payrunId: id, pageSize: MAX_PAGE_SIZE }, user),
      this.detectWarnings(id),
    ]);

    return { ...this.toDto(payrun), payslips: payslips.items, warnings };
  }

  /**
   * Step 2 of the wizard: work out who can actually be paid for this period.
   *
   * An employee is eligible only when a RUNNING contract overlaps the period and
   * they do not already hold a payslip covering it. Warnings do not block
   * selection - they block validation later.
   */
  async getEligibleEmployees(query: EligibilityQueryDto): Promise<EligibleEmployeeDto[]> {
    const periodStart = new Date(query.periodStart);
    const periodEnd = new Date(query.periodEnd);

    const employees = await this.prisma.employee.findMany({
      where: {
        status: { not: 'INACTIVE' },
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.employeeType ? { employeeType: query.employeeType } : {}),
      },
      include: {
        department: true,
        contracts: { include: { salaryStructure: { select: { id: true, name: true } } } },
      },
      orderBy: { firstName: 'asc' },
    });

    const existing = await this.prisma.payslip.findMany({
      where: {
        status: { not: 'CANCELLED' },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      include: { payrun: { select: { name: true } } },
    });

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    return employees.map((e) => {
      const contract = resolveContractForPeriod(e.contracts, periodStart, periodEnd);
      const duplicate = existing.find((p) => p.employeeId === e.id);

      let eligible = true;
      let reason: string | null = null;
      let warning: string | null = null;

      if (!contract) {
        eligible = false;
        reason = `No running contract covering ${fmt(periodStart)} to ${fmt(periodEnd)}`;
      } else if (duplicate) {
        eligible = false;
        reason = `Already has payslip ${duplicate.number} in "${duplicate.payrun?.name ?? 'another run'}"`;
      }

      if (eligible && (!e.bankAccountNumber || !e.bankName)) {
        warning = 'Missing bank details — payment cannot be released';
      }
      if (
        eligible &&
        contract?.salaryStructureId &&
        contract.salaryStructureId !== query.structureId
      ) {
        const structureName = contract.salaryStructure?.name;
        warning = warning
          ? `${warning}; contract uses "${structureName}"`
          : `Contract normally uses "${structureName}"`;
      }

      return {
        id: e.id,
        fullName: `${e.firstName} ${e.lastName}`,
        employeeCode: e.employeeCode,
        department: e.department?.name ?? '—',
        employeeType: e.employeeType,
        wage: contract ? toNumber(contract.wage) : 0,
        contractName: contract?.name ?? '—',
        eligible,
        reason,
        warning,
      };
    });
  }

  /** Creates the batch containing only the explicitly selected employees. */
  async create(dto: CreatePayrunDto, user: AuthenticatedUser): Promise<PayrunDto> {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd < periodStart) {
      throw new BadRequestException('Period end cannot be before the period start.');
    }
    if (dto.employeeIds.length === 0) {
      throw new BadRequestException('Select at least one employee for this pay run.');
    }

    const payrun = await this.prisma.payrun.create({
      data: {
        name: dto.name,
        structureId: dto.structureId,
        periodStart,
        periodEnd,
        status: 'DRAFT',
        departmentFilter: dto.departmentId ?? null,
        employeeTypeFilter: dto.employeeType ?? null,
      },
    });

    // One draft payslip per selected employee; amounts arrive on Compute.
    for (const employeeId of dto.employeeIds) {
      const contract = await this.contracts.getContractForPeriod(
        employeeId,
        periodStart,
        periodEnd
      );
      await this.prisma.payslip.create({
        data: {
          number: await this.payslips.nextPayslipNumber(),
          employeeId,
          payrunId: payrun.id,
          contractId: contract?.id ?? null,
          structureId: dto.structureId,
          periodStart,
          periodEnd,
          status: 'DRAFT',
        },
      });
    }

    return this.findOne(payrun.id, user);
  }

  /** Compute every payslip in the run from live contract, attendance and leave. */
  async compute(id: string, user: AuthenticatedUser): Promise<PayrunDto> {
    const payrun = await this.prisma.payrun.findUnique({
      where: { id },
      include: { payslips: { select: { id: true, employeeId: true } } },
    });
    if (!payrun) throw new NotFoundException('Pay run not found.');
    if (payrun.status === 'PAID') {
      throw new BadRequestException('A paid pay run can no longer be recomputed.');
    }

    for (const slip of payrun.payslips) {
      const result = await this.payslips.computeFor({
        employeeId: slip.employeeId,
        structureId: payrun.structureId,
        periodStart: payrun.periodStart,
        periodEnd: payrun.periodEnd,
      });
      await this.payslips.persistComputation(slip.id, result);
    }

    await this.prisma.payrun.update({
      where: { id },
      data: { status: 'COMPUTED', computedAt: new Date() },
    });

    return this.findOne(id, user);
  }

  /**
   * Payrun-level checks surfaced before validation: duplicates across other
   * runs, missing bank details, absent contracts and negative net pay.
   */
  async detectWarnings(id: string): Promise<string[]> {
    const warnings: string[] = [];

    const payrun = await this.prisma.payrun.findUnique({
      where: { id },
      include: { payslips: { include: { employee: true } } },
    });
    if (!payrun) return warnings;

    if (payrun.payslips.length === 0) {
      warnings.push('This pay run contains no payslips.');
      return warnings;
    }

    const duplicates = await this.prisma.payslip.findMany({
      where: {
        payrunId: { not: id },
        status: { not: 'CANCELLED' },
        employeeId: { in: payrun.payslips.map((p) => p.employeeId) },
        periodStart: { lte: payrun.periodEnd },
        periodEnd: { gte: payrun.periodStart },
      },
      include: { employee: true, payrun: { select: { name: true } } },
    });

    for (const dup of duplicates) {
      warnings.push(
        `Duplicate payslip: ${dup.employee.firstName} ${dup.employee.lastName} already has ${dup.number} for an overlapping period in "${dup.payrun?.name ?? 'another run'}".`
      );
    }

    for (const p of payrun.payslips) {
      if (!p.employee.bankAccountNumber || !p.employee.bankName) {
        warnings.push(
          `Missing bank details: ${p.employee.firstName} ${p.employee.lastName} cannot be paid.`
        );
      }
      if (!p.contractId) {
        warnings.push(
          `No applicable contract: ${p.employee.firstName} ${p.employee.lastName} for this period.`
        );
      }
      if (toNumber(p.netPay) < 0) {
        warnings.push(
          `Negative net pay: ${p.employee.firstName} ${p.employee.lastName} (${toNumber(p.netPay)}).`
        );
      }
    }

    return warnings;
  }

  async validate(id: string, user: AuthenticatedUser): Promise<PayrunDto> {
    const payrun = await this.prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new NotFoundException('Pay run not found.');
    if (payrun.status === 'DRAFT') {
      throw new BadRequestException('Compute the pay run before validating it.');
    }

    const warnings = await this.detectWarnings(id);
    const blocking = warnings.filter((w) => BLOCKING_PREFIXES.some((p) => w.startsWith(p)));

    if (blocking.length > 0) {
      throw new BadRequestException(
        `Cannot validate — resolve these first: ${blocking.slice(0, 3).join(' ')}${
          blocking.length > 3 ? ` (+${blocking.length - 3} more)` : ''
        }`
      );
    }

    await this.prisma.$transaction([
      this.prisma.payslip.updateMany({ where: { payrunId: id }, data: { status: 'VALIDATED' } }),
      this.prisma.payrun.update({
        where: { id },
        data: { status: 'VALIDATED', validatedAt: new Date() },
      }),
    ]);

    await this.notifications.notifyPermission('payruns', 'update', {
      type: 'payrun.validated',
      title: `Pay run "${payrun.name}" was validated`,
      body: 'It can now be marked as paid.',
      href: `/payruns/${id}`,
      actorName: user.name,
      actorId: user.userId,
    });

    return this.findOne(id, user);
  }

  async markPaid(id: string, user: AuthenticatedUser): Promise<PayrunDto> {
    const payrun = await this.prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new NotFoundException('Pay run not found.');
    if (payrun.status !== 'VALIDATED') {
      throw new BadRequestException('Only a validated pay run can be marked as paid.');
    }

    await this.prisma.$transaction([
      this.prisma.payslip.updateMany({ where: { payrunId: id }, data: { status: 'PAID' } }),
      this.prisma.payrun.update({
        where: { id },
        data: { status: 'PAID', paidAt: new Date(), paidBy: user.name },
      }),
    ]);

    const paid = await this.prisma.payslip.findMany({
      where: { payrunId: id },
      select: { employeeId: true },
    });

    await this.notifications.notifyPermission('payslips', 'read', {
      type: 'payrun.paid',
      title: `Pay run "${payrun.name}" was marked paid`,
      body: `${paid.length} payslip(s) released.`,
      href: `/payruns/${id}`,
      actorName: user.name,
      actorId: user.userId,
    });

    // The people it pays are not in payslips:read - the matrix gives an Employee
    // no payslip access at all - so they are told separately, and with no href
    // because there is no page their role can open.
    await this.notifications.notifyEmployees(
      paid.map((p) => p.employeeId),
      {
        type: 'payslip.paid',
        title: 'Your payslip has been paid',
        body: `${payrun.name} was released for payment.`,
        actorName: user.name,
        actorId: user.userId,
      }
    );

    return this.findOne(id, user);
  }

  async sendPayslips(
    id: string,
    user: AuthenticatedUser
  ): Promise<{ sent: number; failed: number }> {
    const payrun = await this.prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new NotFoundException('Pay run not found.');
    if (payrun.status === 'DRAFT') {
      throw new BadRequestException('Compute and validate the pay run before sending payslips.');
    }

    const result = await this.mail.sendPayrunPayslips(id);

    // Not the sender: the counts are in the response they are already waiting on.
    // It is the rest of payroll who cannot see a bulk send any other way.
    await this.notifications.notifyPermission('payslips', 'read', {
      type: 'payslip.sent',
      title: `Payslips sent for "${payrun.name}"`,
      body: `${result.sent} sent, ${result.failed} failed.`,
      href: `/payruns/${id}`,
      actorName: user.name,
      actorId: user.userId,
    });

    return result;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const payrun = await this.prisma.payrun.findUnique({ where: { id } });
    if (!payrun) throw new NotFoundException('Pay run not found.');

    // Paid runs are historical records and must be preserved.
    if (payrun.status === 'PAID') {
      throw new BadRequestException(
        'A paid pay run is a historical record and cannot be deleted.'
      );
    }

    await this.prisma.payrun.delete({ where: { id } });
    return { deleted: true };
  }
}
