'use client';

import { useActionState, useState, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { toDateInput } from '@/lib/utils';
import type { ActionState } from '@/app/(app)/time-off/actions';

export interface LeaveRequestFormValues {
  id?: string;
  employeeId?: string;
  typeId?: string;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  reason?: string | null;
}

export interface TypeOption {
  id: string;
  name: string;
  unit: string;
  requiresAllocation: boolean;
  maxDaysPerRequest: number | null;
}

export interface BalanceInfo {
  typeId: string;
  remaining: number;
  allocated: number;
  unit: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function LeaveRequestForm({
  action,
  request,
  employees,
  types,
  balances,
  submitLabel,
  cancelHref,
  lockEmployee = false,
  readOnly = false,
}: {
  action: (prev: ActionState | null, form: FormData) => Promise<ActionState>;
  request?: LeaveRequestFormValues;
  employees: { id: string; firstName: string; lastName: string }[];
  types: TypeOption[];
  balances: BalanceInfo[];
  submitLabel: string;
  cancelHref: string;
  lockEmployee?: boolean;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [typeId, setTypeId] = useState(request?.typeId ?? types[0]?.id ?? '');
  const [dateFrom, setDateFrom] = useState(toDateInput(request?.dateFrom));
  const [dateTo, setDateTo] = useState(toDateInput(request?.dateTo));

  const selectedType = types.find((t) => t.id === typeId);
  const balance = balances.find((b) => b.typeId === typeId);

  // Rough client-side preview; the server recomputes using the real schedule.
  const estimatedDays = useMemo(() => {
    if (!dateFrom || !dateTo) return 0;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (to < from) return 0;
    let count = 0;
    const cursor = new Date(from);
    while (cursor <= to) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }, [dateFrom, dateTo]);

  const exceedsBalance =
    selectedType?.requiresAllocation && balance ? estimatedDays > balance.remaining : false;

  return (
    <form action={formAction} className="space-y-5">
      {request?.id && <input type="hidden" name="id" value={request.id} />}
      {lockEmployee && request?.employeeId && (
        <input type="hidden" name="employeeId" value={request.employeeId} />
      )}

      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
      {state?.warnings && state.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          {state.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Request Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {!lockEmployee && (
            <div>
              <label className="label" htmlFor="employeeId">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                id="employeeId"
                name="employeeId"
                defaultValue={request?.employeeId ?? ''}
                required
                disabled={readOnly}
                className="input"
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="typeId">
              Time Off Type <span className="text-red-500">*</span>
            </label>
            <select
              id="typeId"
              name="typeId"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              required
              disabled={readOnly}
              className="input"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedType?.requiresAllocation && balance && (
              <p className="mt-1 text-[11px] text-slate-500">
                Balance:{' '}
                <span className="font-semibold text-slate-700">
                  {balance.remaining} of {balance.allocated}
                </span>{' '}
                {balance.unit === 'DAY' ? 'day(s)' : 'hour(s)'} remaining
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="dateFrom">
              From <span className="text-red-500">*</span>
            </label>
            <input
              id="dateFrom"
              name="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              required
              disabled={readOnly}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="dateTo">
              To <span className="text-red-500">*</span>
            </label>
            <input
              id="dateTo"
              name="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              required
              disabled={readOnly}
              className="input"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="reason">
              Reason
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              defaultValue={request?.reason ?? ''}
              disabled={readOnly}
              className="input"
            />
          </div>
        </div>

        {estimatedDays > 0 && (
          <div
            className={`mt-4 rounded-lg border px-3.5 py-2.5 text-sm ${
              exceedsBalance
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            Approximately <span className="font-semibold">{estimatedDays} working day(s)</span>.
            {exceedsBalance && ' This exceeds the remaining balance and will be rejected.'}
            {!exceedsBalance &&
              selectedType?.maxDaysPerRequest &&
              estimatedDays > selectedType.maxDaysPerRequest &&
              ` This type allows at most ${selectedType.maxDaysPerRequest} day(s) per request.`}
            <span className="mt-0.5 block text-[11px] text-slate-500">
              The exact duration is recalculated from the working schedule on save.
            </span>
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 border-t border-slate-200 pt-5">
          <SubmitButton label={submitLabel} />
          <Link href={cancelHref} className="btn-secondary">
            Cancel
          </Link>
        </div>
      )}
    </form>
  );
}
