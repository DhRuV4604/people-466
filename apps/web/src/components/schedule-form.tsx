'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { DAY_NAMES } from '@/lib/utils';
import { computeWeeklyHours, lineHours, type ScheduleLineInput } from '@peoplepay360/shared';
import { saveScheduleAction, type ActionState } from '@/app/(app)/config/actions';

export interface ScheduleFormValues {
  id?: string;
  name?: string;
  scheduleType?: string;
  timezone?: string;
  active?: boolean;
  lines?: ScheduleLineInput[];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

const DEFAULT_LINE: ScheduleLineInput = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '18:00',
  breakHours: 1,
};

export function ScheduleForm({
  schedule,
  submitLabel,
  cancelHref,
  readOnly = false,
}: {
  schedule?: ScheduleFormValues;
  submitLabel: string;
  cancelHref: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(saveScheduleAction, null);
  const [lines, setLines] = useState<ScheduleLineInput[]>(
    schedule?.lines && schedule.lines.length > 0
      ? schedule.lines
      : [1, 2, 3, 4, 5].map((d) => ({ ...DEFAULT_LINE, dayOfWeek: d }))
  );

  // Mirrors the server calculation so the user sees the total before saving.
  const weeklyHours = computeWeeklyHours(lines);

  const update = (index: number, patch: Partial<ScheduleLineInput>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { ...DEFAULT_LINE }]);
  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  return (
    <form action={formAction} className="space-y-5">
      {schedule?.id && <input type="hidden" name="id" value={schedule.id} />}

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
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Schedule Details</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              defaultValue={schedule?.name}
              required
              disabled={readOnly}
              placeholder="Standard 40 Hours/Week"
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="scheduleType">
              Type
            </label>
            <select
              id="scheduleType"
              name="scheduleType"
              defaultValue={schedule?.scheduleType ?? 'FULL_TIME'}
              disabled={readOnly}
              className="input"
            >
              <option value="FULL_TIME">Full time</option>
              <option value="PART_TIME">Part time</option>
              <option value="FLEXIBLE">Flexible</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="timezone">
              Timezone
            </label>
            <input
              id="timezone"
              name="timezone"
              defaultValue={schedule?.timezone ?? 'UTC'}
              disabled={readOnly}
              className="input"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="active"
                defaultChecked={schedule?.active ?? true}
                disabled={readOnly}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Active
            </label>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Weekly Pattern</h3>
            <p className="text-xs text-slate-500">
              Define each working day; the weekly total is calculated automatically.
            </p>
          </div>
          <div className="rounded-lg bg-brand-50 px-4 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">
              Total Weekly Hours
            </p>
            <p className="text-xl font-bold text-brand-700">{weeklyHours}h</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Break (hours)</th>
                <th>Net Hours</th>
                {!readOnly && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    <select
                      name="lineDay"
                      value={line.dayOfWeek}
                      onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}
                      disabled={readOnly}
                      className="input w-36 py-1.5"
                    >
                      {DAY_NAMES.map((d, idx) => (
                        <option key={idx} value={idx}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      name="lineStart"
                      type="time"
                      value={line.startTime}
                      onChange={(e) => update(i, { startTime: e.target.value })}
                      disabled={readOnly}
                      className="input w-32 py-1.5"
                    />
                  </td>
                  <td>
                    <input
                      name="lineEnd"
                      type="time"
                      value={line.endTime}
                      onChange={(e) => update(i, { endTime: e.target.value })}
                      disabled={readOnly}
                      className="input w-32 py-1.5"
                    />
                  </td>
                  <td>
                    <input
                      name="lineBreak"
                      type="number"
                      step="0.25"
                      min="0"
                      value={line.breakHours}
                      onChange={(e) => update(i, { breakHours: Number(e.target.value) })}
                      disabled={readOnly}
                      className="input w-24 py-1.5"
                    />
                  </td>
                  <td className="font-semibold text-slate-900">
                    {lineHours(line).toFixed(2)}h
                  </td>
                  {!readOnly && (
                    <td>
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <button type="button" onClick={addLine} className="btn-secondary btn-sm mt-3">
            Add Day
          </button>
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
