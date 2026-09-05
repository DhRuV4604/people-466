'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import {
  computePayslipFor,
  nextPayslipNumber,
  detectPayrunWarnings,
  evaluateExpression,
  type PayrollContext,
} from '@/lib/payroll';
import { sendPayrunPayslips } from '@/lib/email';
import { getContractForPeriod } from '@/lib/contracts';

export interface ActionState {
  error?: string;
  success?: string;
}

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

// ------------------------------------------------------------------ Salary structures

export async function saveStructureAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  await requirePermission('salaryStructures', id ? 'update' : 'create');

  const name = str(form, 'name');
  const code = str(form, 'code');
  if (!name || !code) return { error: 'Name and code are required.' };

  const data = {
    name,
    code: code.toUpperCase(),
    description: str(form, 'description'),
    active: bool(form, 'active'),
  };

  let structureId = id;
  try {
    if (id) await prisma.salaryStructure.update({ where: { id }, data });
    else {
      const created = await prisma.salaryStructure.create({ data });
      structureId = created.id;
    }
  } catch (err) {
    return {
      error:
        err instanceof Error && err.message.includes('Unique')
          ? 'A structure with this name or code already exists.'
          : 'Failed to save structure.',
    };
  }

  revalidatePath('/payroll/structures');
  if (!id) redirect(`/payroll/structures/${structureId}`);
  return { success: 'Structure saved.' };
}

export async function deleteStructureAction(id: string): Promise<void> {
  await requirePermission('salaryStructures', 'delete');

  const used = await prisma.payslip.count({ where: { structureId: id } });
  // Structures referenced by payslips are archived to preserve payroll history.
  if (used > 0) await prisma.salaryStructure.update({ where: { id }, data: { active: false } });
  else await prisma.salaryStructure.delete({ where: { id } });

  revalidatePath('/payroll/structures');
  redirect('/payroll/structures');
}

// ------------------------------------------------------------------ Salary rules

/** Reject a formula before it is stored, so a bad rule cannot break a payrun. */
function validateFormula(expression: string): string | null {
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
    // Common codes so a formula referencing earlier rules still parses.
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
    evaluateExpression(expression, probe);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid expression.';
  }
}

export async function saveRuleAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  const id = str(form, 'id');
  await requirePermission('salaryRules', id ? 'update' : 'create');

  const name = str(form, 'name');
  const code = str(form, 'code');
  const structureId = str(form, 'structureId');
  const category = str(form, 'category');
  const computeType = str(form, 'computeType') ?? 'FIXED';

  if (!name || !code || !structureId || !category) {
    return { error: 'Name, code, structure and category are required.' };
  }

  const formula = str(form, 'formula');
  const condition = str(form, 'condition');

  if (computeType === 'FORMULA') {
    if (!formula) return { error: 'A formula is required for formula-based rules.' };
    const formulaError = validateFormula(formula);
    if (formulaError) return { error: `Formula error — ${formulaError}` };
  }

  if (computeType === 'PERCENTAGE' && num(form, 'amountPercentage') === null) {
    return { error: 'A percentage value is required for percentage-based rules.' };
  }

  if (condition) {
    const conditionError = validateFormula(condition);
    if (conditionError) return { error: `Condition error — ${conditionError}` };
  }

  const data = {
    name,
    code: code.toUpperCase().replace(/\s+/g, '_'),
    structureId,
    category,
    sequence: num(form, 'sequence') ?? 100,
    computeType,
    amountFixed: computeType === 'FIXED' ? num(form, 'amountFixed') : null,
    amountPercentage: computeType === 'PERCENTAGE' ? num(form, 'amountPercentage') : null,
    percentageBase: computeType === 'PERCENTAGE' ? str(form, 'percentageBase') : null,
    formula: computeType === 'FORMULA' ? formula : null,
    condition,
    appearsOnPayslip: bool(form, 'appearsOnPayslip'),
    active: bool(form, 'active'),
    note: str(form, 'note'),
  };

  try {
    if (id) await prisma.salaryRule.update({ where: { id }, data });
    else await prisma.salaryRule.create({ data });
  } catch (err) {
    return {
      error:
        err instanceof Error && err.message.includes('Unique')
          ? 'A rule with this code already exists in the structure.'
          : 'Failed to save rule.',
    };
  }

  revalidatePath('/payroll/rules');
  revalidatePath(`/payroll/structures/${structureId}`);
  return { success: 'Rule saved.' };
}

export async function deleteRuleAction(id: string): Promise<void> {
  await requirePermission('salaryRules', 'delete');

  const rule = await prisma.salaryRule.findUnique({ where: { id } });
  const used = await prisma.payslipLine.count({ where: { ruleId: id } });

  // Deactivate rather than delete when payslip lines still point at the rule.
  if (used > 0) await prisma.salaryRule.update({ where: { id }, data: { active: false } });
  else await prisma.salaryRule.delete({ where: { id } });

  revalidatePath('/payroll/rules');
  if (rule) revalidatePath(`/payroll/structures/${rule.structureId}`);
}

// ------------------------------------------------------------------ Payruns

/**
 * Step 2 of the wizard: create the batch with only the selected employees, then
 * open the processing view (spec B5).
 */
export async function createPayrunAction(
  _prev: ActionState | null,
  form: FormData
): Promise<ActionState> {
  await requirePermission('payruns', 'create');

  const name = str(form, 'name');
  const structureId = str(form, 'structureId');
  const periodStartRaw = str(form, 'periodStart');
  const periodEndRaw = str(form, 'periodEnd');
  const employeeIds = form.getAll('employeeIds').map(String).filter(Boolean);

  if (!name || !structureId || !periodStartRaw || !periodEndRaw) {
    return { error: 'Name, structure and period are required.' };
  }
  if (employeeIds.length === 0) {
    return { error: 'Select at least one employee for this pay run.' };
  }

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (periodEnd < periodStart) {
    return { error: 'Period end cannot be before the period start.' };
  }

  const payrun = await prisma.payrun.create({
    data: {
      name,
      structureId,
      periodStart,
      periodEnd,
      status: 'DRAFT',
      departmentFilter: str(form, 'departmentId'),
      employeeTypeFilter: str(form, 'employeeType'),
    },
  });

  // Create one draft payslip per selected employee; amounts arrive on Compute.
  for (const employeeId of employeeIds) {
    const contract = await getContractForPeriod(employeeId, periodStart, periodEnd);
    await prisma.payslip.create({
      data: {
        number: await nextPayslipNumber(),
        employeeId,
        payrunId: payrun.id,
        contractId: contract?.id ?? null,
        structureId,
        periodStart,
        periodEnd,
        status: 'DRAFT',
      },
    });
  }

  revalidatePath('/payroll/payruns');
  redirect(`/payroll/payruns/${payrun.id}`);
}

/** Compute every payslip in the run from live contract, attendance and leave data. */
export async function computePayrunAction(payrunId: string): Promise<void> {
  await requirePermission('payruns', 'update');

  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: { payslips: true },
  });
  if (!payrun) throw new Error('Pay run not found.');
  if (payrun.status === 'PAID') throw new Error('A paid pay run can no longer be recomputed.');

  for (const payslip of payrun.payslips) {
    const result = await computePayslipFor({
      employeeId: payslip.employeeId,
      structureId: payrun.structureId,
      periodStart: payrun.periodStart,
      periodEnd: payrun.periodEnd,
    });

    // Replace previous lines so recomputation is idempotent.
    await prisma.payslipLine.deleteMany({ where: { payslipId: payslip.id } });

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: {
        contractId: result.contractId,
        status: 'COMPUTED',
        workedDays: result.workedDays,
        workedHours: result.workedHours,
        leaveDays: result.leaveDays,
        overtimeHours: result.overtimeHours,
        basicWage: result.basicWage,
        grossPay: result.grossPay,
        totalDeductions: result.totalDeductions,
        netPay: result.netPay,
        warnings: JSON.stringify(result.warnings),
        lines: {
          create: result.lines.map((l) => ({
            ruleId: l.ruleId,
            code: l.code,
            name: l.name,
            category: l.category,
            sequence: l.sequence,
            quantity: l.quantity,
            rate: l.rate,
            amount: l.amount,
          })),
        },
      },
    });
  }

  await prisma.payrun.update({
    where: { id: payrunId },
    data: { status: 'COMPUTED', computedAt: new Date() },
  });

  revalidatePath(`/payroll/payruns/${payrunId}`);
  revalidatePath('/payroll/payslips');
}

/** Validation is blocked while blocking warnings remain (spec B6). */
export async function validatePayrunAction(payrunId: string): Promise<void> {
  await requirePermission('payruns', 'update');

  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: { payslips: true },
  });
  if (!payrun) throw new Error('Pay run not found.');
  if (payrun.status === 'DRAFT') throw new Error('Compute the pay run before validating it.');

  const warnings = await detectPayrunWarnings(payrunId);
  const blocking = warnings.filter(
    (w) =>
      w.startsWith('Missing bank details') ||
      w.startsWith('Duplicate payslip') ||
      w.startsWith('No applicable contract') ||
      w.startsWith('Negative net pay')
  );

  if (blocking.length > 0) {
    throw new Error(
      `Cannot validate — resolve these first: ${blocking.slice(0, 3).join(' ')}${
        blocking.length > 3 ? ` (+${blocking.length - 3} more)` : ''
      }`
    );
  }

  await prisma.payslip.updateMany({
    where: { payrunId },
    data: { status: 'VALIDATED' },
  });

  await prisma.payrun.update({
    where: { id: payrunId },
    data: { status: 'VALIDATED', validatedAt: new Date() },
  });

  revalidatePath(`/payroll/payruns/${payrunId}`);
  revalidatePath('/payroll/payslips');
}

export async function markPayrunPaidAction(payrunId: string): Promise<void> {
  const session = await requirePermission('payruns', 'update');

  const payrun = await prisma.payrun.findUnique({ where: { id: payrunId } });
  if (!payrun) throw new Error('Pay run not found.');
  if (payrun.status !== 'VALIDATED') {
    throw new Error('Only a validated pay run can be marked as paid.');
  }

  await prisma.payslip.updateMany({ where: { payrunId }, data: { status: 'PAID' } });

  await prisma.payrun.update({
    where: { id: payrunId },
    data: { status: 'PAID', paidAt: new Date(), paidBy: session.name },
  });

  revalidatePath(`/payroll/payruns/${payrunId}`);
  revalidatePath('/payroll/payslips');
  revalidatePath('/dashboard');
}

export async function sendPayslipsAction(payrunId: string): Promise<{ sent: number; failed: number }> {
  await requirePermission('payruns', 'update');

  const payrun = await prisma.payrun.findUnique({ where: { id: payrunId } });
  if (!payrun) throw new Error('Pay run not found.');
  if (payrun.status === 'DRAFT') {
    throw new Error('Compute and validate the pay run before sending payslips.');
  }

  const result = await sendPayrunPayslips(payrunId);

  revalidatePath(`/payroll/payruns/${payrunId}`);
  revalidatePath('/payroll/outbox');
  return { sent: result.sent, failed: result.failed };
}

export async function deletePayrunAction(payrunId: string): Promise<void> {
  await requirePermission('payruns', 'delete');

  const payrun = await prisma.payrun.findUnique({ where: { id: payrunId } });
  if (!payrun) throw new Error('Pay run not found.');
  // Paid runs are historical records and must be preserved (spec B6).
  if (payrun.status === 'PAID') {
    throw new Error('A paid pay run is a historical record and cannot be deleted.');
  }

  await prisma.payrun.delete({ where: { id: payrunId } });

  revalidatePath('/payroll/payruns');
  redirect('/payroll/payruns');
}

/** Recompute a single payslip without touching the rest of the run. */
export async function recomputePayslipAction(payslipId: string): Promise<void> {
  await requirePermission('payslips', 'update');

  const payslip = await prisma.payslip.findUnique({ where: { id: payslipId } });
  if (!payslip) throw new Error('Payslip not found.');
  if (payslip.status === 'PAID') throw new Error('A paid payslip cannot be recomputed.');

  const result = await computePayslipFor({
    employeeId: payslip.employeeId,
    structureId: payslip.structureId,
    periodStart: payslip.periodStart,
    periodEnd: payslip.periodEnd,
  });

  await prisma.payslipLine.deleteMany({ where: { payslipId } });

  await prisma.payslip.update({
    where: { id: payslipId },
    data: {
      contractId: result.contractId,
      status: 'COMPUTED',
      workedDays: result.workedDays,
      workedHours: result.workedHours,
      leaveDays: result.leaveDays,
      overtimeHours: result.overtimeHours,
      basicWage: result.basicWage,
      grossPay: result.grossPay,
      totalDeductions: result.totalDeductions,
      netPay: result.netPay,
      warnings: JSON.stringify(result.warnings),
      lines: {
        create: result.lines.map((l) => ({
          ruleId: l.ruleId,
          code: l.code,
          name: l.name,
          category: l.category,
          sequence: l.sequence,
          quantity: l.quantity,
          rate: l.rate,
          amount: l.amount,
        })),
      },
    },
  });

  revalidatePath(`/payroll/payslips/${payslipId}`);
}
