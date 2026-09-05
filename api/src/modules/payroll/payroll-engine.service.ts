import { Injectable, BadRequestException } from '@nestjs/common';
import { round2 } from '../../common/decimal';

/**
 * Variables available inside a salary rule formula or condition.
 *
 * Results of earlier rules are injected by their code (BASIC, HRA, ...) so later
 * rules can build on earlier subtotals - this is what makes rule sequencing
 * meaningful rather than decorative.
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

/** Identifiers that could escape the evaluation scope and reach the host. */
const FORBIDDEN_IDENTIFIERS =
  /\b(require|import|process|globalThis|eval|Function|constructor|__proto__|prototype|fetch|window|document|module|exports|child_process|global)\b/;

/** Globals shadowed as undefined inside the evaluated expression. */
const SHADOWED_GLOBALS = [
  'globalThis',
  'global',
  'process',
  'require',
  'module',
  'exports',
  'fetch',
  'window',
  'document',
  'console',
  'setTimeout',
  'setInterval',
];

@Injectable()
export class PayrollEngineService {
  /**
   * Evaluate a rule expression in a restricted scope.
   *
   * Formulas come from an authenticated payroll administrator but are still user
   * input, so only the payroll context and Math are exposed: dangerous
   * identifiers are rejected up front and the usual globals are shadowed.
   */
  evaluateExpression(expression: string, context: PayrollContext): number | boolean {
    const trimmed = expression?.trim();
    if (!trimmed) return 0;

    if (FORBIDDEN_IDENTIFIERS.test(trimmed)) {
      throw new BadRequestException(
        `Formula contains a disallowed identifier: ${trimmed}`
      );
    }

    const keys = Object.keys(context);
    const values = keys.map((k) => context[k]);

    try {
      const fn = new Function(
        ...keys,
        ...SHADOWED_GLOBALS,
        'Math',
        `"use strict"; return (${trimmed});`
      );
      const result = fn(...values, ...SHADOWED_GLOBALS.map(() => undefined), Math);

      if (typeof result === 'boolean') return result;
      const num = Number(result);
      return Number.isFinite(num) ? num : 0;
    } catch (err) {
      throw new BadRequestException(
        `Failed to evaluate "${trimmed}": ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

  /**
   * Run every active rule in sequence order, writing each result back into the
   * context under the rule's code before the next rule runs. That lets a NET
   * rule be expressed as `GROSS - TOTAL_DEDUCTIONS` instead of being hardcoded.
   */
  computeSalaryLines(rules: RuleLike[], context: PayrollContext): ComputationResult {
    const errors: string[] = [];
    const lines: ComputedLine[] = [];

    const scope: PayrollContext = { ...context };
    const ordered = rules
      .filter((r) => r.active)
      .sort((a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code));

    for (const rule of ordered) {
      try {
        if (rule.condition) {
          const passes = this.evaluateExpression(rule.condition, scope);
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
            const result = this.evaluateExpression(rule.formula ?? '0', scope);
            amount = typeof result === 'boolean' ? (result ? 1 : 0) : result;
            break;
          }

          default:
            errors.push(`Rule ${rule.code}: unknown compute type "${rule.computeType}".`);
        }

        amount = round2(amount);
        // Store the magnitude under the rule code; sign comes from the category,
        // so formulas can reference deductions as positive numbers.
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

    // Prefer an explicit GROSS/NET rule when the structure defines one, otherwise
    // derive the totals so every structure still yields a coherent payslip.
    const explicitGross = lines.find((l) => l.category === 'GROSS');
    const explicitNet = lines.find((l) => l.category === 'NET');

    const grossPay = explicitGross ? explicitGross.amount : round2(basicWage + allowances);
    const netPay = explicitNet ? explicitNet.amount : round2(grossPay - deductions);

    return { lines, basicWage, grossPay, totalDeductions: deductions, netPay, errors };
  }

  /**
   * Validate a formula before it is stored so a broken rule cannot break a whole
   * pay run later. Probe values include the common rule codes so an expression
   * referencing earlier rules still parses.
   */
  validateExpression(expression: string): string | null {
    const probe: PayrollContext = {
      wage: 50000,
      workedDays: 22,
      workedHours: 176,
      leaveDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      overtimeHours: 4,
      scheduledDays: 22,
      scheduledHours: 176,
      employeeType: 'FULL_TIME',
      BASIC: 50000,
      HRA: 20000,
      TA: 2400,
      MA: 1800,
      OT: 0,
      GROSS: 74200,
      PF: 1800,
      PT: 200,
      TDS: 0,
      ULD: 0,
      NET: 72200,
    };

    try {
      this.evaluateExpression(expression, probe);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid expression.';
    }
  }
}
