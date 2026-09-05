import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveContractForPeriod, type DashboardDto } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber, round2 } from '../../common/decimal';
import { AttendanceService } from '../attendance/attendance.service';

export interface DashboardFilters {
  periodStart: Date;
  periodEnd: Date;
  departmentId?: string | null;
  employeeType?: string | null;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService
  ) {}

  /**
   * Every figure is derived from live records rather than stored aggregates, so
   * the dashboard always reflects what the operational modules actually contain.
   */
  async getDashboard(filters: DashboardFilters): Promise<DashboardDto> {
    const employeeFilter: Prisma.EmployeeWhereInput = {
      status: { not: 'INACTIVE' },
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.employeeType ? { employeeType: filters.employeeType as never } : {}),
    };

    const relatedEmployeeFilter =
      filters.departmentId || filters.employeeType
        ? {
            employee: {
              ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
              ...(filters.employeeType ? { employeeType: filters.employeeType as never } : {}),
            },
          }
        : {};

    const [employees, payslips, leaveRequests, departments, payruns] = await Promise.all([
      this.prisma.employee.findMany({
        where: employeeFilter,
        include: { department: true, contracts: true },
      }),
      this.prisma.payslip.findMany({
        where: {
          periodStart: { gte: filters.periodStart },
          periodEnd: { lte: filters.periodEnd },
          status: { not: 'CANCELLED' },
          ...relatedEmployeeFilter,
        },
        include: { employee: { include: { department: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          dateFrom: { lte: filters.periodEnd },
          dateTo: { gte: filters.periodStart },
          ...relatedEmployeeFilter,
        },
        include: { type: true },
      }),
      this.prisma.department.findMany(),
      this.prisma.payrun.findMany({
        where: {
          periodStart: { gte: filters.periodStart },
          periodEnd: { lte: filters.periodEnd },
        },
      }),
    ]);

    // ---- KPIs
    const totalNetPaid = round2(payslips.reduce((s, p) => s + toNumber(p.netPay), 0));
    const totalGross = round2(payslips.reduce((s, p) => s + toNumber(p.grossPay), 0));
    const totalDeductions = round2(
      payslips.reduce((s, p) => s + toNumber(p.totalDeductions), 0)
    );
    const averageSalary = payslips.length > 0 ? round2(totalNetPaid / payslips.length) : 0;

    const approvedTimeOffDays = round2(
      leaveRequests
        .filter((r) => r.status === 'APPROVED')
        .reduce((s, r) => s + toNumber(r.duration), 0)
    );

    const attendanceSummary = await this.attendance.getSummary({
      from: filters.periodStart,
      to: filters.periodEnd,
      departmentId: filters.departmentId,
      employeeType: filters.employeeType,
    });

    // ---- Salary cost by department
    const salaryByDepartment = departments
      .map((dept) => {
        const deptPayslips = payslips.filter((p) => p.employee.departmentId === dept.id);
        return {
          department: dept.name,
          totalNet: round2(deptPayslips.reduce((s, p) => s + toNumber(p.netPay), 0)),
          headcount: employees.filter((e) => e.departmentId === dept.id).length,
        };
      })
      .filter((d) => d.headcount > 0 || d.totalNet > 0)
      .sort((a, b) => b.totalNet - a.totalNet);

    // ---- Rolling twelve-month trend, independent of the selected period so the
    // chart shows history rather than a single bar.
    const trendStart = startOfMonth(
      new Date(filters.periodEnd.getFullYear(), filters.periodEnd.getMonth() - 11, 1)
    );
    const trendPayslips = await this.prisma.payslip.findMany({
      where: {
        periodStart: { gte: trendStart },
        periodEnd: { lte: endOfMonth(filters.periodEnd) },
        status: { not: 'CANCELLED' },
        ...relatedEmployeeFilter,
      },
      select: { periodStart: true, netPay: true },
    });

    const monthlyTrend: DashboardDto['monthlyTrend'] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(
        filters.periodEnd.getFullYear(),
        filters.periodEnd.getMonth() - i,
        1
      );
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);

      const inMonth = trendPayslips.filter(
        (p) => p.periodStart >= mStart && p.periodStart <= mEnd
      );

      monthlyTrend.push({
        month: formatMonth(monthDate),
        netSalary: round2(inMonth.reduce((s, p) => s + toNumber(p.netPay), 0)),
        payslips: inMonth.length,
      });
    }

    // ---- Time off breakdown
    const typeMap = new Map<
      string,
      { name: string; colorHex: string; days: number; requests: number }
    >();
    for (const r of leaveRequests.filter((r) => r.status === 'APPROVED')) {
      const existing = typeMap.get(r.typeId) ?? {
        name: r.type.name,
        colorHex: r.type.colorHex,
        days: 0,
        requests: 0,
      };
      existing.days = round2(existing.days + toNumber(r.duration));
      existing.requests += 1;
      typeMap.set(r.typeId, existing);
    }

    // ---- Operational alerts
    const missingBankDetails = employees
      .filter((e) => !e.bankAccountNumber || !e.bankName)
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department?.name ?? '—',
      }));

    const noContract = employees
      .filter(
        (e) => resolveContractForPeriod(e.contracts, filters.periodStart, filters.periodEnd) === null
      )
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department?.name ?? '—',
      }));

    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 86400000);
    const expiring = await this.prisma.contract.findMany({
      where: { status: 'RUNNING', dateEnd: { not: null, gte: now, lte: horizon } },
      include: { employee: true },
      orderBy: { dateEnd: 'asc' },
    });
    const expiringContracts = expiring.map((c) => ({
      id: c.id,
      name: `${c.employee.firstName} ${c.employee.lastName}`,
      dateEnd: c.dateEnd?.toISOString() ?? null,
    }));

    // Duplicates: one employee holding more than one payslip for the same month.
    const byEmployeePeriod = new Map<string, { employee: string; numbers: string[] }>();
    for (const p of payslips) {
      const key = `${p.employeeId}-${p.periodStart.toISOString().slice(0, 7)}`;
      const existing = byEmployeePeriod.get(key) ?? {
        employee: `${p.employee.firstName} ${p.employee.lastName}`,
        numbers: [],
      };
      existing.numbers.push(p.number);
      byEmployeePeriod.set(key, existing);
    }
    const duplicatePayslips = [...byEmployeePeriod.values()].filter((v) => v.numbers.length > 1);

    const draftPayruns = payruns
      .filter((p) => p.status === 'DRAFT' || p.status === 'COMPUTED')
      .map((p) => ({ id: p.id, name: p.name, status: p.status }));

    const pendingAllocations = await this.prisma.leaveAllocation.count({
      where: { status: 'DRAFT' },
    });

    // ---- Breakdowns
    const payrunStatusBreakdown = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'].map((status) => ({
      status,
      count: payruns.filter((p) => p.status === status).length,
    }));

    const employeeTypeBreakdown = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']
      .map((type) => ({ type, count: employees.filter((e) => e.employeeType === type).length }))
      .filter((t) => t.count > 0);

    return {
      kpis: {
        totalNetPaid,
        payslipsGenerated: payslips.length,
        averageSalary,
        approvedTimeOffDays,
        attendanceHealth: attendanceSummary.healthPercent,
        headcount: employees.length,
        totalGross,
        totalDeductions,
      },
      salaryByDepartment,
      monthlyTrend,
      attendance: attendanceSummary,
      timeOff: {
        approvedDays: approvedTimeOffDays,
        pendingRequests: leaveRequests.filter((r) => r.status === 'TO_APPROVE').length,
        refusedRequests: leaveRequests.filter((r) => r.status === 'REFUSED').length,
        byType: [...typeMap.values()].sort((a, b) => b.days - a.days),
      },
      alerts: {
        missingBankDetails,
        noContract,
        expiringContracts,
        duplicatePayslips,
        draftPayruns,
        pendingAllocations,
      },
      payrunStatusBreakdown,
      employeeTypeBreakdown,
    };
  }

  /** The most recent month that actually has payroll, for a sensible default view. */
  async getLatestPayrollMonth(): Promise<string | null> {
    const latest = await this.prisma.payslip.findFirst({
      orderBy: { periodStart: 'desc' },
      select: { periodStart: true },
    });
    if (!latest) return null;
    return latest.periodStart.toISOString().slice(0, 7);
  }
}
