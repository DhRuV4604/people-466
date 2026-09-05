import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { workingDaysInRange, type ScheduleLineInput, type PayslipDto } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber, toDecimal } from '../../common/decimal';
import { ContractsService } from '../contracts/contracts.service';
import { AttendanceService } from '../attendance/attendance.service';
import { TimeOffService } from '../time-off/time-off.service';
import { PayrollEngineService, type PayrollContext } from './payroll-engine.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { QueryPayslipsDto } from './dto/payroll.dto';
import { NO_MATCH_ID } from '../../common/scoping';

const PAYSLIP_INCLUDE = {
  employee: { include: { department: true, jobPosition: true } },
  payrun: { select: { id: true, name: true } },
  contract: { select: { id: true, name: true } },
  structure: { select: { id: true, name: true } },
  lines: { orderBy: { sequence: 'asc' } },
} satisfies Prisma.PayslipInclude;

type PayslipRow = Prisma.PayslipGetPayload<{ include: typeof PAYSLIP_INCLUDE }>;

export interface PayslipComputationOutput {
  contractId: string | null;
  workedDays: number;
  workedHours: number;
  leaveDays: number;
  overtimeHours: number;
  basicWage: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  lines: {
    ruleId: string;
    code: string;
    name: string;
    category: string;
    sequence: number;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  warnings: string[];
}

@Injectable()
export class PayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: ContractsService,
    private readonly attendance: AttendanceService,
    private readonly timeOff: TimeOffService,
    private readonly engine: PayrollEngineService
  ) {}

  toDto(p: PayslipRow): PayslipDto {
    return {
      id: p.id,
      number: p.number,
      employeeId: p.employeeId,
      employee: {
        id: p.employee.id,
        fullName: `${p.employee.firstName} ${p.employee.lastName}`,
        employeeCode: p.employee.employeeCode,
        department: p.employee.department?.name ?? null,
        jobPosition: p.employee.jobPosition?.name ?? null,
      },
      payrunId: p.payrunId,
      payrun: p.payrun,
      contractId: p.contractId,
      contract: p.contract,
      structureId: p.structureId,
      structure: p.structure,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      status: p.status,
      workedDays: toNumber(p.workedDays),
      workedHours: toNumber(p.workedHours),
      leaveDays: toNumber(p.leaveDays),
      overtimeHours: toNumber(p.overtimeHours),
      basicWage: toNumber(p.basicWage),
      grossPay: toNumber(p.grossPay),
      totalDeductions: toNumber(p.totalDeductions),
      netPay: toNumber(p.netPay),
      warnings: p.warnings,
      lines: p.lines.map((l) => ({
        id: l.id,
        ruleId: l.ruleId,
        code: l.code,
        name: l.name,
        category: l.category,
        sequence: l.sequence,
        quantity: toNumber(l.quantity),
        rate: toNumber(l.rate),
        amount: toNumber(l.amount),
      })),
    };
  }

  /**
   * Build one employee's payslip figures for a period, pulling the applicable
   * contract plus real attendance and approved leave, then running the
   * structure's rules in sequence.
   */
  async computeFor(input: {
    employeeId: string;
    structureId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<PayslipComputationOutput> {
    const warnings: string[] = [];

    const [employee, structure] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: input.employeeId },
        include: { workingSchedule: { include: { lines: true } } },
      }),
      this.prisma.salaryStructure.findUnique({
        where: { id: input.structureId },
        include: { rules: { orderBy: { sequence: 'asc' } } },
      }),
    ]);

    if (!employee) throw new NotFoundException('Employee not found.');
    if (!structure) throw new NotFoundException('Salary structure not found.');

    const contract = await this.contracts.getContractForPeriod(
      input.employeeId,
      input.periodStart,
      input.periodEnd
    );

    if (!contract) {
      warnings.push('No running contract covers this payroll period; wage defaulted to 0.');
    }
    if (!employee.bankAccountNumber || !employee.bankName) {
      warnings.push('Missing bank details — payment cannot be released.');
    }

    // A contract-level schedule overrides the employee default for payroll.
    const rawLines = contract?.workingSchedule?.lines ?? employee.workingSchedule?.lines ?? [];
    const scheduleLines: ScheduleLineInput[] = rawLines.map((l) => ({
      dayOfWeek: l.dayOfWeek,
      startTime: l.startTime,
      endTime: l.endTime,
      breakHours: toNumber(l.breakHours),
    }));

    if (scheduleLines.length === 0) {
      warnings.push('No working schedule assigned; scheduled days estimated at 22 per month.');
    }

    const [worked, leave] = await Promise.all([
      this.attendance.getWorkedTimeInPeriod(input.employeeId, input.periodStart, input.periodEnd),
      this.timeOff.approvedLeaveDaysInPeriod(
        input.employeeId,
        input.periodStart,
        input.periodEnd
      ),
    ]);

    const scheduledDaysCount =
      scheduleLines.length > 0
        ? workingDaysInRange(scheduleLines, input.periodStart, input.periodEnd)
        : 22;

    if (worked.days === 0 && leave.total === 0) {
      warnings.push('No attendance or approved leave recorded for this period.');
    }
    if (leave.unpaid > 0) {
      warnings.push(`${leave.unpaid} unpaid leave day(s) will reduce net pay.`);
    }

    const context: PayrollContext = {
      wage: contract ? toNumber(contract.wage) : 0,
      workedDays: worked.days,
      workedHours: worked.hours,
      leaveDays: leave.total,
      paidLeaveDays: leave.paid,
      unpaidLeaveDays: leave.unpaid,
      overtimeHours: worked.overtime,
      scheduledDays: scheduledDaysCount,
      scheduledHours: scheduledDaysCount * 8,
      employeeType: employee.employeeType,
    };

    const rules = structure.rules.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      category: r.category,
      sequence: r.sequence,
      computeType: r.computeType,
      amountFixed: r.amountFixed ? toNumber(r.amountFixed) : null,
      amountPercentage: r.amountPercentage ? toNumber(r.amountPercentage) : null,
      percentageBase: r.percentageBase,
      formula: r.formula,
      condition: r.condition,
      appearsOnPayslip: r.appearsOnPayslip,
      active: r.active,
    }));

    const result = this.engine.computeSalaryLines(rules, context);
    warnings.push(...result.errors);

    if (result.netPay < 0) {
      warnings.push('Computed net pay is negative — review deductions.');
    }

    return {
      contractId: contract?.id ?? null,
      workedDays: worked.days,
      workedHours: worked.hours,
      leaveDays: leave.total,
      overtimeHours: worked.overtime,
      basicWage: result.basicWage,
      grossPay: result.grossPay,
      totalDeductions: result.totalDeductions,
      netPay: result.netPay,
      lines: result.lines,
      warnings,
    };
  }

  /** Persist a computed result onto an existing payslip, replacing prior lines. */
  async persistComputation(payslipId: string, result: PayslipComputationOutput): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.payslipLine.deleteMany({ where: { payslipId } }),
      this.prisma.payslip.update({
        where: { id: payslipId },
        data: {
          contractId: result.contractId,
          status: 'COMPUTED',
          workedDays: toDecimal(result.workedDays),
          workedHours: toDecimal(result.workedHours),
          leaveDays: toDecimal(result.leaveDays),
          overtimeHours: toDecimal(result.overtimeHours),
          basicWage: toDecimal(result.basicWage),
          grossPay: toDecimal(result.grossPay),
          totalDeductions: toDecimal(result.totalDeductions),
          netPay: toDecimal(result.netPay),
          warnings: result.warnings,
          lines: {
            create: result.lines.map((l) => ({
              ruleId: l.ruleId,
              code: l.code,
              name: l.name,
              category: l.category as never,
              sequence: l.sequence,
              quantity: toDecimal(l.quantity),
              rate: new Prisma.Decimal(l.rate.toFixed(4)),
              amount: toDecimal(l.amount),
            })),
          },
        },
      }),
    ]);
  }

  async nextPayslipNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.payslip.count();
    return `PS/${year}/${String(count + 1).padStart(6, '0')}`;
  }

  async findAll(query: QueryPayslipsDto, user: AuthenticatedUser): Promise<PayslipDto[]> {
    const scoped =
      user.role === 'EMPLOYEE' ? { employeeId: user.employeeId ?? NO_MATCH_ID } : {};

    const payslips = await this.prisma.payslip.findMany({
      where: {
        ...scoped,
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.payrunId ? { payrunId: query.payrunId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { number: { contains: query.q, mode: 'insensitive' as const } },
                { employee: { firstName: { contains: query.q, mode: 'insensitive' as const } } },
                { employee: { lastName: { contains: query.q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: PAYSLIP_INCLUDE,
      orderBy: [{ periodStart: 'desc' }, { number: 'desc' }],
      take: query.limit ?? 300,
    });

    return payslips.map((p) => this.toDto(p));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<PayslipDto> {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: PAYSLIP_INCLUDE,
    });
    if (!payslip) throw new NotFoundException('Payslip not found.');

    // An employee may open only their own payslip.
    if (user.role === 'EMPLOYEE' && payslip.employeeId !== user.employeeId) {
      throw new NotFoundException('Payslip not found.');
    }
    return this.toDto(payslip);
  }

  /** Recompute a single payslip without touching the rest of its pay run. */
  async recompute(id: string, user: AuthenticatedUser): Promise<PayslipDto> {
    const payslip = await this.prisma.payslip.findUnique({ where: { id } });
    if (!payslip) throw new NotFoundException('Payslip not found.');
    if (payslip.status === 'PAID') {
      throw new BadRequestException('A paid payslip cannot be recomputed.');
    }

    const result = await this.computeFor({
      employeeId: payslip.employeeId,
      structureId: payslip.structureId,
      periodStart: payslip.periodStart,
      periodEnd: payslip.periodEnd,
    });

    await this.persistComputation(id, result);
    return this.findOne(id, user);
  }
}
