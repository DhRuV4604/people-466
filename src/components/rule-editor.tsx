'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui';
import { formatMoney } from '@/lib/utils';
import { saveRuleAction, deleteRuleAction } from '@/app/(app)/payroll/actions';

export interface RuleRow {
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
  note: string | null;
}

const CATEGORY_TONES: Record<string, 'violet' | 'emerald' | 'blue' | 'red' | 'amber' | 'slate'> = {
  BASIC: 'violet',
  ALLOWANCE: 'emerald',
  GROSS: 'blue',
  DEDUCTION: 'red',
  CONTRIBUTION: 'amber',
  NET: 'blue',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function RuleEditor({
  structureId,
  rules,
  canManage,
  canDelete,
}: {
  structureId: string;
  rules: RuleRow[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const [creating, setCreating] = useState(false);

  const ordered = [...rules].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Salary Rules</h3>
          <p className="text-xs text-slate-500">
            Rules run in ascending sequence; each result is available to later rules by its code.
          </p>
        </div>
        {canManage && !creating && !editing && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary btn-sm">
            Add Rule
          </button>
        )}
      </div>

      {(creating || editing) && (
        <div className="mb-5">
          <RuleForm
            structureId={structureId}
            rule={editing ?? undefined}
            existingCodes={rules.map((r) => r.code)}
            nextSequence={
              ordered.length > 0 ? ordered[ordered.length - 1].sequence + 10 : 10
            }
            onDone={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No rules yet. Add a Basic rule first, then allowances and deductions.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-16">Seq</th>
                <th>Rule</th>
                <th>Code</th>
                <th>Category</th>
                <th>Computation</th>
                <th>On Payslip</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {ordered.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                  <td className="font-mono text-xs text-slate-500">{r.sequence}</td>
                  <td>
                    <span className="font-medium text-slate-900">{r.name}</span>
                    {r.note && <p className="mt-0.5 max-w-xs text-xs text-slate-500">{r.note}</p>}
                    {r.condition && (
                      <p className="mt-0.5 font-mono text-[11px] text-amber-700">
                        if ({r.condition})
                      </p>
                    )}
                  </td>
                  <td>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                      {r.code}
                    </code>
                  </td>
                  <td>
                    <Badge tone={CATEGORY_TONES[r.category] ?? 'slate'}>{r.category}</Badge>
                  </td>
                  <td className="max-w-xs">
                    <RuleComputation rule={r} />
                  </td>
                  <td>
                    {r.appearsOnPayslip ? (
                      <Badge tone="emerald">Shown</Badge>
                    ) : (
                      <Badge tone="slate">Hidden</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(r);
                            setCreating(false);
                          }}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        {canDelete && <DeleteRuleButton id={r.id} />}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RuleComputation({ rule }: { rule: RuleRow }) {
  if (rule.computeType === 'FIXED') {
    return <span className="text-sm">{formatMoney(rule.amountFixed ?? 0)}</span>;
  }
  if (rule.computeType === 'PERCENTAGE') {
    return (
      <span className="text-sm">
        {rule.amountPercentage}% of{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
          {rule.percentageBase ?? 'BASIC'}
        </code>
      </span>
    );
  }
  return (
    <code className="block break-words rounded bg-slate-100 px-1.5 py-1 font-mono text-[11px] text-slate-700">
      {rule.formula}
    </code>
  );
}

function RuleForm({
  structureId,
  rule,
  existingCodes,
  nextSequence,
  onDone,
}: {
  structureId: string;
  rule?: RuleRow;
  existingCodes: string[];
  nextSequence: number;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveRuleAction, null);
  const [computeType, setComputeType] = useState(rule?.computeType ?? 'FIXED');

  if (state?.success) setTimeout(onDone, 0);

  return (
    <form action={formAction} className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <input type="hidden" name="structureId" value={structureId} />

      <h4 className="mb-3 text-sm font-semibold text-slate-900">
        {rule ? `Edit rule — ${rule.name}` : 'New salary rule'}
      </h4>

      {state?.error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="name">
            Name <span className="text-red-500">*</span>
          </label>
          <input id="name" name="name" defaultValue={rule?.name} required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="code">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            name="code"
            defaultValue={rule?.code}
            required
            placeholder="HRA"
            className="input font-mono uppercase"
          />
        </div>

        <div>
          <label className="label" htmlFor="category">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="category"
            defaultValue={rule?.category ?? 'ALLOWANCE'}
            required
            className="input"
          >
            <option value="BASIC">Basic</option>
            <option value="ALLOWANCE">Allowance</option>
            <option value="GROSS">Gross</option>
            <option value="DEDUCTION">Deduction</option>
            <option value="CONTRIBUTION">Contribution</option>
            <option value="NET">Net</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="sequence">
            Sequence
          </label>
          <input
            id="sequence"
            name="sequence"
            type="number"
            defaultValue={rule?.sequence ?? nextSequence}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="computeType">
            Computation
          </label>
          <select
            id="computeType"
            name="computeType"
            value={computeType}
            onChange={(e) => setComputeType(e.target.value)}
            className="input"
          >
            <option value="FIXED">Fixed amount</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FORMULA">Formula</option>
          </select>
        </div>

        {computeType === 'FIXED' && (
          <div>
            <label className="label" htmlFor="amountFixed">
              Amount
            </label>
            <input
              id="amountFixed"
              name="amountFixed"
              type="number"
              step="0.01"
              defaultValue={rule?.amountFixed ?? 0}
              className="input"
            />
          </div>
        )}

        {computeType === 'PERCENTAGE' && (
          <>
            <div>
              <label className="label" htmlFor="amountPercentage">
                Percentage
              </label>
              <input
                id="amountPercentage"
                name="amountPercentage"
                type="number"
                step="0.01"
                defaultValue={rule?.amountPercentage ?? 0}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="percentageBase">
                Of Rule Code
              </label>
              <select
                id="percentageBase"
                name="percentageBase"
                defaultValue={rule?.percentageBase ?? 'BASIC'}
                className="input font-mono"
              >
                {[...new Set(['BASIC', ...existingCodes])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {computeType === 'FORMULA' && (
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="formula">
              Formula
            </label>
            <input
              id="formula"
              name="formula"
              defaultValue={rule?.formula ?? ''}
              placeholder="GROSS - PF - PT"
              className="input font-mono text-xs"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="label" htmlFor="condition">
            Condition (optional)
          </label>
          <input
            id="condition"
            name="condition"
            defaultValue={rule?.condition ?? ''}
            placeholder="GROSS > 15000"
            className="input font-mono text-xs"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="note">
            Note
          </label>
          <input id="note" name="note" defaultValue={rule?.note ?? ''} className="input" />
        </div>

        <div className="flex items-end gap-4 pb-1 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="appearsOnPayslip"
              defaultChecked={rule?.appearsOnPayslip ?? true}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Show on payslip
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={rule?.active ?? true}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Active
          </label>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-[11px] text-slate-600">
        <span className="font-semibold">Available variables:</span>{' '}
        <code className="font-mono">
          wage, workedDays, workedHours, paidLeaveDays, unpaidLeaveDays, overtimeHours,
          scheduledDays, scheduledHours
        </code>{' '}
        plus the code of any rule with a lower sequence, and <code className="font-mono">Math</code>.
      </div>

      <div className="mt-4 flex items-center gap-2">
        <SubmitButton label={rule ? 'Save Rule' : 'Add Rule'} />
        <button type="button" onClick={onDone} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteRuleButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-medium text-red-600 hover:underline"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteRuleAction(id))}
        className="font-medium text-red-600 hover:underline"
      >
        {pending ? '…' : 'Yes'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-slate-500 hover:underline"
      >
        No
      </button>
    </span>
  );
}
