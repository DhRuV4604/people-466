import { prisma } from './prisma';
import { round2, startOfMonth, endOfMonth, formatMonth } from './utils';
import { getAttendanceSummary } from './attendance';
import { findExpiringContracts, employeesWithoutValidContract } from './contracts';

export interface DashboardFilters {
  periodStart: Date;
  periodEnd: Date;
  departmentId?: string | null;
  employeeType?: string | null;
}

export interface DashboardData {
  kpis: {
    totalNetPaid: number;
    payslipsGenerated: number;
    averageSalary: number;
    approvedTimeOffDays: number;
    attendanceHealth: number;
    headcount: number;
    totalGross: number;
    totalDeductions: number;
  };
  salaryByDepartment: { department: string; totalNet: number; headcount: number }[];
  monthlyTrend: { month: string; netSalary: number; payslips: number }[];
  attendance: Awaited<ReturnType<typeof getAttendanceSummary>>;
  timeOff: {
    approvedDays: number;
    pendingRequests: number;
    refusedRequests: number;
    byType: { name: string; colorHex: string; days: number; requests: number }[];
  };
  alerts: {
    missingBankDetails: { id: string; name: string; department: string }[];
    noContract: { id: string; name: string; department: string }[];
    expiringContracts: { id: string; name: string; dateEnd: Date | null }[];
    duplicatePayslips: { employee: string; numbers: string[] }[];
    draftPayruns: { id: string; name: string; status: string }[];
    pendingAllocations: number;
  };
  payrunStatusBreakdown: { status: string; count: number }[];
  employeeTypeBreakdown: { type: string; count: number }[];
}

/**
 * Every figure here is derived from live records rather than stored aggregates,
 * so the dashboard always reflects what the operational modules actually contain
 * (spec A7/B9).
 */
export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  const employeeWhere = {
    status: { not: 'INACTIVE' },
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.employeeType ? { employeeType: filters.employeeType } : {}),
  };

  const payslipWhere = {
    periodStart: { gte: filters.periodStart },
    periodEnd: { lte: filters.periodEnd },
    status: { not: 'CANCELLED' },
    ...(filters.departmentId || filters.employeeType
      ? {
          employee: {
            ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
            ...(filters.employeeType ? { employeeType: filters.employeeType } : {}),
          },
        }
      : {}),
  };

  const [employees, payslips, leaveRequests, departments, payruns] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhere,
      include: { department: true },
    }),
    prisma.payslip.findMany({
      where: payslipWhere,
      include: { employee: { include: { department: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        dateFrom: { lte: filters.periodEnd },
        dateTo: { gte: filters.periodStart },
        ...(filters.departmentId || filters.employeeType
          ? {
              employee: {
                ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
                ...(filters.employeeType ? { employeeType: filters.employeeType } : {}),
              },
            }
          : {}),
      },
      include: { type: true },
    }),
    prisma.department.findMany(),
    prisma.payrun.findMany({
      where: {
        periodStart: { gte: filters.periodStart },
        periodEnd: { lte: filters.periodEnd },
      },
    }),
  ]);

  // ---- KPIs
  const totalNetPaid = round2(payslips.reduce((s, p) => s + p.netPay, 0));
  const totalGross = round2(payslips.reduce((s, p) => s + p.grossPay, 0));
  const totalDeductions = round2(payslips.reduce((s, p) => s + p.totalDeductions, 0));
  const averageSalary = payslips.length > 0 ? round2(totalNetPaid / payslips.length) : 0;

  const approvedTimeOffDays = round2(
    leaveRequests.filter((r) => r.status === 'APPROVED').reduce((s, r) => s + r.duration, 0)
  );

  const attendance = await getAttendanceSummary({
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
        totalNet: round2(deptPayslips.reduce((s, p) => s + p.netPay, 0)),
        headcount: employees.filter((e) => e.departmentId === dept.id).length,
      };
    })
    .filter((d) => d.headcount > 0 || d.totalNet > 0)
    .sort((a, b) => b.totalNet - a.totalNet);

  // ---- Twelve-month net salary trend, independent of the selected period so the
  // chart always shows history rather than a single bar.
  const trendStart = startOfMonth(
    new Date(filters.periodEnd.getFullYear(), filters.periodEnd.getMonth() - 11, 1)
  );
  const trendPayslips = await prisma.payslip.findMany({
    where: {
      periodStart: { gte: trendStart },
      periodEnd: { lte: endOfMonth(filters.periodEnd) },
      status: { not: 'CANCELLED' },
      ...(filters.departmentId || filters.employeeType
        ? {
            employee: {
              ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
              ...(filters.employeeType ? { employeeType: filters.employeeType } : {}),
            },
          }
        : {}),
    },
  });

  const monthlyTrend: { month: string; netSalary: number; payslips: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(filters.periodEnd.getFullYear(), filters.periodEnd.getMonth() - i, 1);
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);

    const inMonth = trendPayslips.filter(
      (p) => p.periodStart >= mStart && p.periodStart <= mEnd
    );

    monthlyTrend.push({
      month: formatMonth(monthDate),
      netSalary: round2(inMonth.reduce((s, p) => s + p.netPay, 0)),
      payslips: inMonth.length,
    });
  }

  // ---- Time off breakdown
  const typeMap = new Map<string, { name: string; colorHex: string; days: number; requests: number }>();
  for (const r of leaveRequests.filter((r) => r.status === 'APPROVED')) {
    const existing = typeMap.get(r.typeId) ?? {
      name: r.type.name,
      colorHex: r.type.colorHex,
      days: 0,
      requests: 0,
    };
    existing.days = round2(existing.days + r.duration);
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

  const withoutContract = await employeesWithoutValidContract(
    filters.periodStart,
    filters.periodEnd
  );
  const noContract = withoutContract
    .filter((e) => !filters.departmentId || e.departmentId === filters.departmentId)
    .filter((e) => !filters.employeeType || e.employeeType === filters.employeeType)
    .map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      department: e.department?.name ?? '—',
    }));

  const expiring = await findExpiringContracts(30);
  const expiringContracts = expiring.map((c) => ({
    id: c.id,
    name: `${c.employee.firstName} ${c.employee.lastName}`,
    dateEnd: c.dateEnd,
  }));

  // Duplicates: an employee holding more than one payslip covering the same period.
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

  const pendingAllocations = await prisma.leaveAllocation.count({ where: { status: 'DRAFT' } });

  // ---- Breakdowns
  const payrunStatusBreakdown = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'].map((status) => ({
    status,
    count: payruns.filter((p) => p.status === status).length,
  }));

  const employeeTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
  const employeeTypeBreakdown = employeeTypes
    .map((type) => ({ type, count: employees.filter((e) => e.employeeType === type).length }))
    .filter((t) => t.count > 0);

  return {
    kpis: {
      totalNetPaid,
      payslipsGenerated: payslips.length,
      averageSalary,
      approvedTimeOffDays,
      attendanceHealth: attendance.healthPercent,
      headcount: employees.length,
      totalGross,
      totalDeductions,
    },
    salaryByDepartment,
    monthlyTrend,
    attendance,
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
