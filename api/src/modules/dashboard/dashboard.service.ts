import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  resolveContractForPeriod,
  type DashboardDto,
  type DashboardTask,
} from '@peoplepay360/shared';
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

    // The horizon for expiring contracts is computed here so the query can join
    // the batch below rather than run after it.
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 86400000);

    const payslipFilter: Prisma.PayslipWhereInput = {
      periodStart: { gte: filters.periodStart },
      periodEnd: { lte: filters.periodEnd },
      status: { not: 'CANCELLED' },
      ...relatedEmployeeFilter,
    };

    // The rolling trend is independent of the selected period, so its window is
    // computed up front and its query joins the batch below.
    const trendStart = startOfMonth(
      new Date(filters.periodEnd.getFullYear(), filters.periodEnd.getMonth() - 11, 1)
    );

    const [
      employees,
      payslips,
      leaveRequests,
      departments,
      payruns,
      attendanceSummary,
      expiring,
      pendingAllocations,
      payslipTotals,
      trendPayslips,
      neverInvited,
      awaitingSignature,
      missingCheckout,
      // Counted separately from the sample above: the sample is capped so the
      // payload stays small, and a capped list reporting its own length would
      // say "20" however many there really are.
      neverInvitedCount,
      awaitingSignatureCount,
      missingCheckoutCount,
    ] = await Promise.all([
      this.prisma.employee.findMany({
        where: employeeFilter,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeType: true,
          departmentId: true,
          bankName: true,
          bankAccountNumber: true,
          department: { select: { name: true } },
          contracts: true,
        },
      }),
      // Only the fields the aggregates and duplicate check below actually read.
      // The full employee+department include re-serialised the same department
      // once per payslip.
      this.prisma.payslip.findMany({
        where: payslipFilter,
        select: {
          number: true,
          employeeId: true,
          periodStart: true,
          netPay: true,
          employee: {
            select: { firstName: true, lastName: true, departmentId: true },
          },
        },
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
      // These three depend on nothing else in the batch, so they belong in it
      // rather than as separate awaits further down.
      this.attendance.getSummary({
        from: filters.periodStart,
        to: filters.periodEnd,
        departmentId: filters.departmentId,
        employeeType: filters.employeeType,
      }),
      this.prisma.contract.findMany({
        where: { status: 'RUNNING', dateEnd: { not: null, gte: now, lte: horizon } },
        select: {
          id: true,
          dateEnd: true,
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { dateEnd: 'asc' },
      }),
      this.prisma.leaveAllocation.count({ where: { status: 'DRAFT' } }),
      // Postgres sums the money columns; Node only formats the result.
      this.prisma.payslip.aggregate({
        where: payslipFilter,
        _count: { _all: true },
        _sum: { netPay: true, grossPay: true, totalDeductions: true },
      }),
      this.prisma.payslip.findMany({
        where: {
          periodStart: { gte: trendStart },
          periodEnd: { lte: endOfMonth(filters.periodEnd) },
          status: { not: 'CANCELLED' },
          ...relatedEmployeeFilter,
        },
        select: { periodStart: true, netPay: true },
      }),
      // Accounts that exist but have never been asked to sign in. The identity
      // migration created these, and nothing else on the dashboard surfaces
      // them - they are invisible until someone wonders why a colleague cannot
      // log in.
      this.prisma.employee.findMany({
        where: { user: { invitedAt: null, active: false }, ...employeeFilter },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
        take: 20,
      }),
      this.prisma.document.findMany({
        where: { status: 'AWAITING_SIGNATURE' },
        select: {
          id: true,
          title: true,
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { sentAt: 'asc' },
        take: 20,
      }),
      this.prisma.attendance.findMany({
        where: {
          checkOut: null,
          checkIn: { gte: filters.periodStart, lte: filters.periodEnd },
          ...relatedEmployeeFilter,
        },
        select: {
          id: true,
          checkIn: true,
          employee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { checkIn: 'desc' },
        take: 20,
      }),
      this.prisma.employee.count({
        where: { user: { invitedAt: null, active: false }, ...employeeFilter },
      }),
      this.prisma.document.count({ where: { status: 'AWAITING_SIGNATURE' } }),
      this.prisma.attendance.count({
        where: {
          checkOut: null,
          checkIn: { gte: filters.periodStart, lte: filters.periodEnd },
          ...relatedEmployeeFilter,
        },
      }),
    ]);

    // ---- KPIs
    const payslipCount = payslipTotals._count._all;
    const totalNetPaid = round2(toNumber(payslipTotals._sum.netPay));
    const totalGross = round2(toNumber(payslipTotals._sum.grossPay));
    const totalDeductions = round2(toNumber(payslipTotals._sum.totalDeductions));
    const averageSalary = payslipCount > 0 ? round2(totalNetPaid / payslipCount) : 0;

    const approvedTimeOffDays = round2(
      leaveRequests
        .filter((r) => r.status === 'APPROVED')
        .reduce((s, r) => s + toNumber(r.duration), 0)
    );

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

    // ---- Rolling twelve-month trend, bucketed from the batch query above.
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


    // ---- Tasks
    //
    // The same facts as the alerts above, shaped for doing rather than
    // reading: each carries the id its action needs, and they are ordered by
    // how much trouble ignoring one causes. Leave sits first because somebody
    // is waiting on an answer; a draft pay run sits above an expiring contract
    // because it blocks this month rather than next quarter.
    const pendingLeave = leaveRequests
      .filter((r) => r.status === 'TO_APPROVE')
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        name: employees.find((e) => e.id === r.employeeId)
          ? `${employees.find((e) => e.id === r.employeeId)!.firstName} ${employees.find((e) => e.id === r.employeeId)!.lastName}`
          : r.type.name,
        detail: `${r.type.name} · ${r.dateFrom.toISOString().slice(0, 10)} to ${r.dateTo.toISOString().slice(0, 10)}`,
      }));

    const subjectsOf = (
      rows: { id: string; name: string; department?: string; detail?: string | null }[]
    ) =>
      rows.slice(0, 20).map((r) => ({
        id: r.id,
        name: r.name,
        detail: r.detail ?? r.department ?? null,
      }));

    const tasks: DashboardTask[] = [
      { kind: 'PENDING_LEAVE' as const, count: leaveRequests.filter((r) => r.status === 'TO_APPROVE').length, subjects: pendingLeave },
      { kind: 'MISSING_BANK' as const, count: missingBankDetails.length, subjects: subjectsOf(missingBankDetails) },
      { kind: 'NO_CONTRACT' as const, count: noContract.length, subjects: subjectsOf(noContract) },
      {
        kind: 'NEVER_INVITED' as const,
        count: neverInvitedCount,
        subjects: neverInvited.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          detail: e.department?.name ?? null,
        })),
      },
      {
        kind: 'AWAITING_SIGNATURE' as const,
        count: awaitingSignatureCount,
        subjects: awaitingSignature.map((d) => ({
          id: d.id,
          name: d.title,
          detail: `${d.employee.firstName} ${d.employee.lastName}`,
        })),
      },
      {
        kind: 'DRAFT_PAYRUN' as const,
        count: draftPayruns.length,
        subjects: draftPayruns.map((p) => ({ id: p.id, name: p.name, detail: p.status })),
      },
      {
        kind: 'EXPIRING_CONTRACT' as const,
        count: expiringContracts.length,
        subjects: expiringContracts.map((c) => ({
          id: c.id,
          name: c.name,
          detail: c.dateEnd ? `ends ${c.dateEnd.slice(0, 10)}` : null,
        })),
      },
      {
        kind: 'MISSING_CHECKOUT' as const,
        count: missingCheckoutCount,
        subjects: missingCheckout.map((a) => ({
          id: a.id,
          name: `${a.employee.firstName} ${a.employee.lastName}`,
          detail: `checked in ${a.checkIn.toISOString().slice(0, 10)}`,
        })),
      },
      // Nothing to do is worth saying, so the empty ones are dropped here
      // rather than rendered as a row of zeros nobody needs to scan.
    ].filter((task) => task.count > 0);

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
        payslipsGenerated: payslipCount,
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
      period: {
        start: filters.periodStart.toISOString(),
        end: filters.periodEnd.toISOString(),
        label: filters.periodStart.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        }),
      },
      tasks,
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
