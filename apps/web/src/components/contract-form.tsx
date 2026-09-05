'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { toDateInput } from '@/lib/utils';
import type { ActionState } from '@/app/(app)/contracts/actions';

interface Option {
  id: string;
  name: string;
}

export interface ContractFormValues {
  id?: string;
  name?: string;
  employeeId?: string;
  dateStart?: string | null;
  dateEnd?: string | null;
  status?: string;
  wage?: number;
  contractType?: string;
  jobPositionId?: string | null;
  workingScheduleId?: string | null;
  salaryStructureId?: string | null;
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

export function ContractForm({
  action,
  contract,
  employees,
  positions,
  schedules,
  structures,
  submitLabel,
  cancelHref,
  lockEmployee = false,
  readOnly = false,
}: {
  action: (prev: ActionState | null, form: FormData) => Promise<ActionState>;
  contract?: ContractFormValues;
  employees: { id: string; fullName: string }[];
  positions: Option[];
  schedules: Option[];
  structures: Option[];
  submitLabel: string;
  cancelHref: string;
  lockEmployee?: boolean;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {contract?.id && <input type="hidden" name="id" value={contract.id} />}
      {lockEmployee && contract?.employeeId && (
        <input type="hidden" name="employeeId" value={contract.employeeId} />
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
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Contract Details</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Contract Reference <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              defaultValue={contract?.name}
              required
              disabled={readOnly}
              placeholder="e.g. Priya Patel — Senior Engineer 2026"
              className="input"
            />
          </div>

          {!lockEmployee && (
            <div>
              <label className="label" htmlFor="employeeId">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                id="employeeId"
                name="employeeId"
                defaultValue={contract?.employeeId ?? ''}
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
            <label className="label" htmlFor="dateStart">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="dateStart"
              name="dateStart"
              type="date"
              defaultValue={toDateInput(contract?.dateStart)}
              required
              disabled={readOnly}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="dateEnd">
              End Date
            </label>
            <input
              id="dateEnd"
              name="dateEnd"
              type="date"
              defaultValue={toDateInput(contract?.dateEnd)}
              disabled={readOnly}
              className="input"
            />
            <p className="mt-1 text-[11px] text-slate-400">Leave empty for an open-ended contract.</p>
          </div>

          <div>
            <label className="label" htmlFor="wage">
              Monthly Wage <span className="text-red-500">*</span>
            </label>
            <input
              id="wage"
              name="wage"
              type="number"
              step="0.01"
              min="0"
              defaultValue={contract?.wage}
              required
              disabled={readOnly}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="contractType">
              Contract Type
            </label>
            <select
              id="contractType"
              name="contractType"
              defaultValue={contract?.contractType ?? 'PERMANENT'}
              disabled={readOnly}
              className="input"
            >
              <option value="PERMANENT">Permanent</option>
              <option value="FIXED_TERM">Fixed term</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="FREELANCE">Freelance</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={contract?.status ?? 'DRAFT'}
              disabled={readOnly}
              className="input"
            >
              <option value="DRAFT">Draft</option>
              <option value="RUNNING">Running</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Only Running contracts are used by payroll.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Employment Terms</h3>
        <p className="mb-4 text-xs text-slate-500">
          The schedule and structure chosen here take precedence over the employee defaults during payroll.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="jobPositionId">
              Job Position
            </label>
            <select
              id="jobPositionId"
              name="jobPositionId"
              defaultValue={contract?.jobPositionId ?? ''}
              disabled={readOnly}
              className="input"
            >
              <option value="">—</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="workingScheduleId">
              Working Schedule
            </label>
            <select
              id="workingScheduleId"
              name="workingScheduleId"
              defaultValue={contract?.workingScheduleId ?? ''}
              disabled={readOnly}
              className="input"
            >
              <option value="">—</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="salaryStructureId">
              Salary Structure
            </label>
            <select
              id="salaryStructureId"
              name="salaryStructureId"
              defaultValue={contract?.salaryStructureId ?? ''}
              disabled={readOnly}
              className="input"
            >
              <option value="">—</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={contract?.notes ?? ''}
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
