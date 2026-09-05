'use client';

import { useState, useTransition } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { formatMoney, cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { EligibleEmployeeDto } from '@peoplepay360/shared';
import { createPayrunAction, fetchEligibleEmployees } from '../../actions';

interface Option {
  id: string;
  name: string;
}

function CreateButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || count === 0}>
      {pending ? 'Creating…' : `Create Pay Run (${count})`}
    </button>
  );
}

export function PayrunWizard({
  structures,
  departments,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  structures: Option[];
  departments: Option[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  // The wizard holds scope in local state; nothing is persisted until step 2
  // completes, so "Continue" never creates a record (spec B5).
  const [step, setStep] = useState<1 | 2>(1);
  const [scope, setScope] = useState({
    name: '',
    structureId: structures[0]?.id ?? '',
    periodStart: defaultPeriodStart,
    periodEnd: defaultPeriodEnd,
    departmentId: '',
    employeeType: '',
  });

  const [candidates, setCandidates] = useState<EligibleEmployeeDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(createPayrunAction, null);

  const continueToStep2 = () => {
    setError(null);

    if (!scope.structureId) return setError('Select a salary structure.');
    if (!scope.periodStart || !scope.periodEnd) return setError('Select the payroll period.');
    if (new Date(scope.periodEnd) < new Date(scope.periodStart)) {
      return setError('Period end cannot be before the period start.');
    }

    startLoading(async () => {
      try {
        const rows = await fetchEligibleEmployees({
          periodStart: scope.periodStart,
          periodEnd: scope.periodEnd,
          departmentId: scope.departmentId || undefined,
          employeeType: scope.employeeType || undefined,
          structureId: scope.structureId,
        });
        setCandidates(rows);
        // Pre-select everyone who can actually be paid.
        setSelected(new Set(rows.filter((r) => r.eligible).map((r) => r.id)));
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employees.');
      }
    });
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const eligible = candidates.filter((c) => c.eligible);
  const ineligible = candidates.filter((c) => !c.eligible);

  const defaultName =
    scope.name ||
    `Payroll ${new Date(scope.periodStart).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    })}`;

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-3">
        <StepChip active={step === 1} done={step === 2} number={1} label="Scope & Period" />
        <div className={cn('h-px flex-1', step === 2 ? 'bg-brand-400' : 'bg-slate-200')} />
        <StepChip active={step === 2} done={false} number={2} label="Select Employees" />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {state?.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {step === 1 && (
        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Step 1 — Define the scope</h3>
          <p className="mb-4 text-xs text-slate-500">
            Nothing is created yet. Continue moves to employee selection.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">
                Pay Run Name
              </label>
              <input
                id="name"
                value={scope.name}
                onChange={(e) => setScope({ ...scope, name: e.target.value })}
                placeholder={defaultName}
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="structureId">
                Salary Structure <span className="text-red-500">*</span>
              </label>
              <select
                id="structureId"
                value={scope.structureId}
                onChange={(e) => setScope({ ...scope, structureId: e.target.value })}
                className="input"
              >
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Decides which salary rules compute every payslip in this run.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="departmentId">
                Department (optional)
              </label>
              <select
                id="departmentId"
                value={scope.departmentId}
                onChange={(e) => setScope({ ...scope, departmentId: e.target.value })}
                className="input"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="periodStart">
                Period Start <span className="text-red-500">*</span>
              </label>
              <input
                id="periodStart"
                type="date"
                value={scope.periodStart}
                onChange={(e) => setScope({ ...scope, periodStart: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="periodEnd">
                Period End <span className="text-red-500">*</span>
              </label>
              <input
                id="periodEnd"
                type="date"
                value={scope.periodEnd}
                onChange={(e) => setScope({ ...scope, periodEnd: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="employeeType">
                Employee Type (optional)
              </label>
              <select
                id="employeeType"
                value={scope.employeeType}
                onChange={(e) => setScope({ ...scope, employeeType: e.target.value })}
                className="input"
              >
                <option value="">All types</option>
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={continueToStep2}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Loading employees…' : 'Continue'}
            </button>
            <Link href="/payroll/payruns" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </div>
      )}

      {step === 2 && (
        <form action={formAction}>
          {/* Scope carried forward from step 1 */}
          <input type="hidden" name="name" value={defaultName} />
          <input type="hidden" name="structureId" value={scope.structureId} />
          <input type="hidden" name="periodStart" value={scope.periodStart} />
          <input type="hidden" name="periodEnd" value={scope.periodEnd} />
          <input type="hidden" name="departmentId" value={scope.departmentId} />
          <input type="hidden" name="employeeType" value={scope.employeeType} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="employeeIds" value={id} />
          ))}

          <div className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Step 2 — Select employees
                </h3>
                <p className="text-xs text-slate-500">
                  {eligible.length} eligible · {ineligible.length} excluded ·{' '}
                  <span className="font-semibold text-brand-700">{selected.size} selected</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(new Set(eligible.map((e) => e.id)))}
                  className="btn-secondary btn-sm"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="btn-secondary btn-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            {eligible.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
                No eligible employees for this period. Every candidate either lacks a running
                contract or already has a payslip covering these dates.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-10"></th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Contract Wage</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(e.id)}
                            onChange={() => toggle(e.id)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600"
                          />
                        </td>
                        <td>
                          <span className="font-medium text-slate-900">{e.fullName}</span>
                          <span className="ml-2 font-mono text-xs text-slate-400">
                            {e.employeeCode}
                          </span>
                        </td>
                        <td>{e.department}</td>
                        <td>
                          <Badge tone="slate">{e.employeeType.replace('_', ' ')}</Badge>
                        </td>
                        <td className="font-semibold">{formatMoney(e.wage)}</td>
                        <td>
                          {e.warning ? (
                            <span className="text-xs text-amber-700">{e.warning}</span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {ineligible.length > 0 && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Excluded ({ineligible.length})
                </p>
                <div className="space-y-1.5">
                  {ineligible.map((e) => (
                    <div key={e.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-700">{e.fullName}</span>
                      <span className="text-right text-slate-500">{e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4">
              <CreateButton count={selected.size} />
              <button type="button" onClick={() => setStep(1)} className="btn-secondary">
                Back
              </button>
              <Link href="/payroll/payruns" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function StepChip({
  active,
  done,
  number,
  label,
}: {
  active: boolean;
  done: boolean;
  number: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
          active
            ? 'bg-brand-600 text-white'
            : done
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-200 text-slate-500'
        )}
      >
        {done ? '✓' : number}
      </span>
      <span
        className={cn(
          'text-sm font-medium',
          active ? 'text-slate-900' : done ? 'text-emerald-700' : 'text-slate-400'
        )}
      >
        {label}
      </span>
    </div>
  );
}
