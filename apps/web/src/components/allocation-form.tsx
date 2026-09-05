'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { toDateInput } from '@/lib/utils';
import type { ActionState } from '@/app/(app)/time-off/actions';

export interface AllocationFormValues {
  id?: string;
  employeeId?: string;
  typeId?: string;
  quantity?: number;
  validFrom?: string | null;
  validTo?: string | null;
  status?: string;
  notes?: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function AllocationForm({
  action,
  allocation,
  employees,
  types,
  submitLabel,
  cancelHref,
  lockEmployee = false,
  readOnly = false,
}: {
  action: (prev: ActionState | null, form: FormData) => Promise<ActionState>;
  allocation?: AllocationFormValues;
  employees: { id: string; fullName: string }[];
  types: { id: string; name: string; unit: string }[];
  submitLabel: string;
  cancelHref: string;
  lockEmployee?: boolean;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {allocation?.id && <input type="hidden" name="id" value={allocation.id} />}
      {lockEmployee && allocation?.employeeId && (
        <input type="hidden" name="employeeId" value={allocation.employeeId} />
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

      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Allocation Details</h3>
        <p className="mb-4 text-xs text-slate-500">
          Only approved allocations contribute to an employee&apos;s available balance.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {!lockEmployee && (
            <div>
              <label className="label" htmlFor="employeeId">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                id="employeeId"
                name="employeeId"
                defaultValue={allocation?.employeeId ?? ''}
                required
                disabled={readOnly}
                className="input"
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
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
              defaultValue={allocation?.typeId ?? ''}
              required
              disabled={readOnly}
              className="input"
            >
              <option value="">Select type…</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.unit === 'DAY' ? 'days' : 'hours'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="quantity">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              step="0.5"
              min="0.5"
              defaultValue={allocation?.quantity}
              required
              disabled={readOnly}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={allocation?.status ?? 'DRAFT'}
              disabled={readOnly}
              className="input"
            >
              <option value="DRAFT">Awaiting approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REFUSED">Refused</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="validFrom">
              Valid From <span className="text-red-500">*</span>
            </label>
            <input
              id="validFrom"
              name="validFrom"
              type="date"
              defaultValue={toDateInput(allocation?.validFrom)}
              required
              disabled={readOnly}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="validTo">
              Valid To
            </label>
            <input
              id="validTo"
              name="validTo"
              type="date"
              defaultValue={toDateInput(allocation?.validTo)}
              disabled={readOnly}
              className="input"
            />
            <p className="mt-1 text-[11px] text-slate-400">Leave empty for no expiry.</p>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={allocation?.notes ?? ''}
              disabled={readOnly}
              className="input"
            />
          </div>
        </div>
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
