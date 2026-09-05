import { prisma } from './prisma';
import { round2 } from './utils';
import { getContractForPeriod } from './contracts';
import { getWorkedTimeInPeriod } from './attendance';
import { approvedLeaveDaysInPeriod } from './timeoff';
import { workingDaysInRange, type ScheduleLineInput } from './schedule';

export const RULE_CATEGORIES = [
  'BASIC',
  'ALLOWANCE',
  'GROSS',
  'DEDUCTION',
  'CONTRIBUTION',
  'NET',
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  BASIC: 'Basic',
  ALLOWANCE: 'Allowance',
  GROSS: 'Gross',
  DEDUCTION: 'Deduction',
  CONTRIBUTION: 'Contribution',
  NET: 'Net',
};

/** Deductions and contributions reduce net pay; everything else adds to it. */
export function isNegativeCategory(category: string): boolean {
  return category === 'DEDUCTION' || category === 'CONTRIBUTION';
}

export const COMPUTE_TYPES = ['FIXED', 'PERCENTAGE', 'FORMULA'] as const;

// ------------------------------------------------------------------ Formula evaluation

/**
 * Variables available inside a salary rule formula or condition. Prior rule
 * results are injected by their code (BASIC, HRA, ...) so later rules can build
 * on earlier subtotals, which is what makes rule sequencing meaningful.
 */
export interface PayrollContext {
  wage: number;
  workedDays: number;
  workedHours: number;
  leaveDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  overtimeHours: number;
  scheduledDays: number;
  scheduledHours: number;
  employeeType: string;
  [ruleCode: string]: number | string;
}

/**
 * Evaluate a rule expression in a restricted scope.
 *
 * Formulas come from an authenticated payroll administrator, but they are still
 * user input, so the evaluator exposes only the payroll context plus Math and
 * blocks anything that could reach the host: the Function body runs with all
 * context keys shadowed as parameters and globals shadowed as undefined.
 */
export function evaluateExpression(
  expression: string,
  context: PayrollContext
): number | boolean {
  const trimmed = expression?.trim();
  if (!trimmed) return 0;

  // Reject obvious escape hatches before we build the evaluator.
  const forbidden = /\b(require|import|process|globalThis|eval|Function|constructor|__proto__|fetch|window|document)\b/;
  if (forbidden.test(trimmed)) {
    throw new Error(`Formula contains a disallowed identifier: ${trimmed}`);
  }

  const keys = Object.keys(context);
  const values = keys.map((k) => context[k]);

  // Shadow the usual globals so the expression cannot reach them.
  const shadowed = ['globalThis', 'process', 'require', 'module', 'exports', 'fetch', 'window', 'document'];

  try {
    const fn = new Function(
      ...keys,
      ...shadowed,
      'Math',
      `"use strict"; return (${trimmed});`
    );
    const result = fn(...values, ...shadowed.map(() => undefined), Math);

    if (typeof result === 'boolean') return result;
    const num = Number(result);
    return Number.isFinite(num) ? num : 0;
  } catch (err) {
    throw new Error(
      `Failed to evaluate "${trimmed}": ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

export interface RuleLike {
  id: string;
  name: string;
  code: string;
  category: string;
  sequence: number;
  computeType: string;
  amountFixed: number | null;
  amountPercentage: number | null;
  percentageBase: string | null;
  formula: string | null;
  condition: string | null;
  appearsOnPayslip: boolean;
  active: boolean;
}

export interface ComputedLine {
  ruleId: string;
  code: string;
  name: string;
  category: string;
  sequence: number;
  quantity: number;
  rate: number;
  amount: number;
}

export interface ComputationResult {
  lines: ComputedLine[];
  basicWage: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  errors: string[];
}

/**
 * Run every active rule in sequence order. Each result is written back into the
 * context under the rule's code before the next rule runs, so a NET rule can be
 * expressed as `GROSS - TOTAL_DEDUCTIONS` rather than being hardcoded.
 */
export function computeSalaryLines(
  rules: RuleLike[],
  context: PayrollContext
): ComputationResult {
  const errors: string[] = [];
  const lines: ComputedLine[] = [];

  const scope: PayrollContext = { ...context };
  const ordered = rules
    .filter((r) => r.active)
    .sort((a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code));

  for (const rule of ordered) {
    try {
      if (rule.condition) {
        const passes = evaluateExpression(rule.condition, scope);
        if (!passes) {
          scope[rule.code] = 0;
          continue;
        }
      }

      let amount = 0;
      let quantity = 1;
      let rate = 100;

      switch (rule.computeType) {
        case 'FIXED':
          amount = rule.amountFixed ?? 0;
          break;

        case 'PERCENTAGE': {
          const baseCode = rule.percentageBase ?? 'BASIC';
          const baseValue = Number(scope[baseCode] ?? 0);
          const pct = rule.amountPercentage ?? 0;
          quantity = baseValue;
          rate = pct;
          amount = (baseValue * pct) / 100;
          break;
        }

        case 'FORMULA': {
          const result = evaluateExpression(rule.formula ?? '0', scope);
          amount = typeof result === 'boolean' ? (result ? 1 : 0) : result;
          break;
        }

        default:
          errors.push(`Rule ${rule.code}: unknown compute type "${rule.computeType}".`);
      }

      amount = round2(amount);
      // Store the magnitude under the rule code; sign is applied by category so
      // formulas can reference deductions as positive numbers.
      scope[rule.code] = amount;

      if (rule.appearsOnPayslip) {
        lines.push({
          ruleId: rule.id,
          code: rule.code,
          name: rule.name,
          category: rule.category,
          sequence: rule.sequence,
          quantity: round2(quantity),
          rate: round2(rate),
          amount,
        });
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Rule ${rule.code} failed.`);
      scope[rule.code] = 0;
    }
  }

  const sumCategory = (cat: string) =>
    round2(lines.filter((l) => l.category === cat).reduce((s, l) => s + l.amount, 0));

  const basicWage = sumCategory('BASIC');
  const allowances = sumCategory('ALLOWANCE');
  const deductions = round2(sumCategory('DEDUCTION') + sumCategory('CONTRIBUTION'));

  // Prefer an explicit GROSS/NET rule when the structure defines one; otherwise
  // derive the totals so every structure produces a coherent payslip.
  const explicitGross = lines.find((l) => l.category === 'GROSS');
  const explicitNet = lines.find((l) => l.category === 'NET');

  const grossPay = explicitGross ? explicitGross.amount : round2(basicWage + allowances);
  const netPay = explicitNet ? explicitNet.amount : round2(grossPay - deductions);

  return {
    lines,
    basicWage,
    grossPay,
    totalDeductions: deductions,
    netPay,
    errors,
  };
}

// ------------------------------------------------------------------ Payslip computation

export interface PayslipComputationInput {
  employeeId: string;
  structureId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface PayslipComputationOutput extends ComputationResult {
  contractId: string | null;
  workedDays: number;
  workedHours: number;
  leaveDays: number;
  overtimeHours: number;
  warnings: string[];
}

/**
 * Build one employee's payslip figures for a period. Pulls the applicable
 * contract, real attendance and approved leave, then runs the structure's rules.
 */
export async function computePayslipFor(
  input: PayslipComputationInput
): Promise<PayslipComputationOutput> {
  const warnings: string[] = [];

  const [employee, structure] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: { workingSchedule: { include: { lines: true } }, department: true },
    }),
    prisma.salaryStructure.findUnique({
      where: { id: input.structureId },
      include: { rules: { orderBy: { sequence: 'asc' } } },
    }),
  ]);

  if (!employee) throw new Error('Employee not found.');
  if (!structure) throw new Error('Salary structure not found.');

  const contract = await getContractForPeriod(
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

  // A contract-level schedule overrides the employee default for payroll purposes.
  const scheduleLines: ScheduleLineInput[] =
    contract?.workingSchedule?.lines ?? employee.workingSchedule?.lines ?? [];

  if (scheduleLines.length === 0) {
    warnings.push('No working schedule assigned; scheduled days estimated at 5 per week.');
  }

  const [worked, leave] = await Promise.all([
    getWorkedTimeInPeriod(input.employeeId, input.periodStart, input.periodEnd),
    approvedLeaveDaysInPeriod(input.employeeId, input.periodStart, input.periodEnd),
  ]);

  const scheduledDaysCount =
    scheduleLines.length > 0
      ? workingDaysInRange(scheduleLines, input.periodStart, input.periodEnd)
      : 22;

  const scheduledHoursCount = scheduledDaysCount * 8;

  if (worked.days === 0 && leave.total === 0) {
    warnings.push('No attendance or approved leave recorded for this period.');
  }

  if (leave.unpaid > 0) {
    warnings.push(`${leave.unpaid} unpaid leave day(s) will reduce net pay.`);
  }

  const context: PayrollContext = {
    wage: contract?.wage ?? 0,
    workedDays: worked.days,
    workedHours: worked.hours,
    leaveDays: leave.total,
    paidLeaveDays: leave.paid,
    unpaidLeaveDays: leave.unpaid,
    overtimeHours: worked.overtime,
    scheduledDays: scheduledDaysCount,
    scheduledHours: scheduledHoursCount,
    employeeType: employee.employeeType,
  };

  const result = computeSalaryLines(structure.rules, context);
  warnings.push(...result.errors);

  if (result.netPay < 0) {
    warnings.push('Computed net pay is negative — review deductions.');
  }

  return {
    ...result,
    contractId: contract?.id ?? null,
    workedDays: worked.days,
    workedHours: worked.hours,
    leaveDays: leave.total,
    overtimeHours: worked.overtime,
    warnings,
  };
}

/** Sequential payslip numbering, e.g. PS/2026/000123. */
export async function nextPayslipNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.payslip.count();
  return `PS/${year}/${String(count + 1).padStart(6, '0')}`;
}

/**
 * Payrun-level checks surfaced before validation (spec B6): duplicates across
 * other payruns, missing bank details, and absent contracts.
 */
export async function detectPayrunWarnings(payrunId: string): Promise<string[]> {
  const warnings: string[] = [];

  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: {
      payslips: { include: { employee: true } },
    },
  });
  if (!payrun) return warnings;

  if (payrun.payslips.length === 0) {
    warnings.push('This payrun contains no payslips.');
    return warnings;
  }

  // Same employee paid twice for an overlapping period in a different payrun.
  const duplicates = await prisma.payslip.findMany({
    where: {
      payrunId: { not: payrunId },
      status: { not: 'CANCELLED' },
      employeeId: { in: payrun.payslips.map((p) => p.employeeId) },
      periodStart: { lte: payrun.periodEnd },
      periodEnd: { gte: payrun.periodStart },
    },
    include: { employee: true, payrun: true },
  });

  for (const dup of duplicates) {
    warnings.push(
      `Duplicate payslip: ${dup.employee.firstName} ${dup.employee.lastName} already has ${dup.number} for an overlapping period in "${dup.payrun?.name ?? 'another run'}".`
    );
  }

  const missingBank = payrun.payslips.filter(
    (p) => !p.employee.bankAccountNumber || !p.employee.bankName
  );
  for (const p of missingBank) {
    warnings.push(
      `Missing bank details: ${p.employee.firstName} ${p.employee.lastName} cannot be paid.`
    );
  }

  const noContract = payrun.payslips.filter((p) => !p.contractId);
  for (const p of noContract) {
    warnings.push(
      `No applicable contract: ${p.employee.firstName} ${p.employee.lastName} for this period.`
    );
  }

  const negative = payrun.payslips.filter((p) => p.netPay < 0);
  for (const p of negative) {
    warnings.push(
      `Negative net pay: ${p.employee.firstName} ${p.employee.lastName} (${p.netPay}).`
    );
  }

  return warnings;
}

export const PAYRUN_STATUSES = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED'] as const;
export const PAYSLIP_STATUSES = ['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED'] as const;
