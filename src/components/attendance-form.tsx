'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { toDateTimeInput } from '@/lib/utils';
import type { ActionState } from '@/app/(app)/attendance/actions';

export interface AttendanceFormValues {
  id?: string;
  employeeId?: string;
  checkIn?: Date | null;
  checkOut?: Date | null;
  status?: string;
  notes?: string | null;
  manuallyEdited?: boolean;
  editReason?: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function AttendanceForm({
  action,
  record,
  employees,
  submitLabel,
  cancelHref,
  isEdit = false,
  lockEmployee = false,
  readOnly = false,
}: {
  action: (prev: ActionState | null, form: FormData) => Promise<ActionState>;
  record?: AttendanceFormValues;
  employees: { id: string; firstName: string; lastName: string }[];
  submitLabel: string;
  cancelHref: string;
  isEdit?: boolean;
  lockEmployee?: boolean;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {record?.id && <input type="hidden" name="id" value={record.id} />}
      {lockEmployee && record?.employeeId && (
        <input type="hidden" name="employeeId" value={record.employeeId} />
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
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Attendance Entry</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {!lockEmployee && (
            <div>
              <label className="label" htmlFor="employeeId">
                Employee <span className="text-red-500">*</span>
              </label>
              <select
                id="employeeId"
                name="employeeId"
                defaultValue={record?.employeeId ?? ''}
                required
                disabled={readOnly || isEdit}
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
            <label className="label" htmlFor="checkIn">
              Check In <span className="text-red-500">*</span>
            </label>
            <input
              id="checkIn"
              name="checkIn"
              type="datetime-local"
              defaultValue={toDateTimeInput(record?.checkIn)}
              required
              disabled={readOnly}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="checkOut">
              Check Out
            </label>
            <input
              id="checkOut"
              name="checkOut"
              type="datetime-local"
              defaultValue={toDateTimeInput(record?.checkOut)}
              disabled={readOnly}
              className="input"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Leave empty for an open shift. Worked hours are computed automatically.
            </p>
          </div>

          {isEdit && (
            <div>
              <label className="label" htmlFor="status">
                Status Override
              </label>
              <select
                id="status"
                name="status"
                defaultValue={record?.status ?? ''}
                disabled={readOnly}
                className="input"
              >
                <option value="">Derive automatically</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half day</option>
                <option value="MISSING_CHECKOUT">Missing checkout</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={record?.notes ?? ''}
              disabled={readOnly}
              className="input"
            />
          </div>

          {isEdit && (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="editReason">
                Correction Reason
              </label>
              <input
                id="editReason"
                name="editReason"
                defaultValue={record?.editReason ?? ''}
                disabled={readOnly}
                placeholder="e.g. Biometric device failure"
                className="input"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Manual corrections are recorded against your account for audit.
              </p>
            </div>
          )}
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
