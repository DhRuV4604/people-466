'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui';
import { saveTimeOffTypeAction, deleteTimeOffTypeAction } from '../actions';

export interface TypeRow {
  id: string;
  name: string;
  code: string;
  unit: string;
  requiresAllocation: boolean;
  requiresApproval: boolean;
  paid: boolean;
  colorHex: string;
  maxDaysPerRequest: number | null;
  active: boolean;
  requestCount: number;
  allocationCount: number;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function TimeOffTypesManager({
  types,
  canManage,
  canDelete,
}: {
  types: TypeRow[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<TypeRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {canManage && !creating && !editing && (
        <div className="mb-4">
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            New Time Off Type
          </button>
        </div>
      )}

      {(creating || editing) && (
        <div className="mb-5">
          <TypeForm
            type={editing ?? undefined}
            onDone={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <div key={t.id} className={`card p-4 ${t.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-8 w-2 rounded-full"
                  style={{ background: t.colorHex }}
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  <p className="font-mono text-xs text-slate-500">{t.code}</p>
                </div>
              </div>
              {!t.active && <Badge tone="slate">Archived</Badge>}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="slate">{t.unit === 'DAY' ? 'Days' : 'Hours'}</Badge>
              {t.requiresAllocation && <Badge tone="violet">Needs allocation</Badge>}
              {t.requiresApproval && <Badge tone="amber">Needs approval</Badge>}
              <Badge tone={t.paid ? 'emerald' : 'red'}>{t.paid ? 'Paid' : 'Unpaid'}</Badge>
              {t.maxDaysPerRequest && <Badge tone="blue">Max {t.maxDaysPerRequest}</Badge>}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>
                {t.requestCount} request(s) · {t.allocationCount} allocation(s)
              </span>
              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(t);
                      setCreating(false);
                    }}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    Edit
                  </button>
                  {canDelete && <DeleteTypeButton id={t.id} inUse={t.requestCount > 0} />}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TypeForm({ type, onDone }: { type?: TypeRow; onDone: () => void }) {
  const [state, formAction] = useActionState(saveTimeOffTypeAction, null);

  // Close the editor once the server confirms the save.
  if (state?.success) {
    setTimeout(onDone, 0);
  }

  return (
    <form action={formAction} className="card p-5">
      {type && <input type="hidden" name="id" value={type.id} />}

      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        {type ? `Edit ${type.name}` : 'New Time Off Type'}
      </h3>

      {state?.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">
            Name <span className="text-red-500">*</span>
          </label>
          <input id="name" name="name" defaultValue={type?.name} required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="code">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            name="code"
            defaultValue={type?.code}
            required
            placeholder="ANNUAL"
            className="input font-mono uppercase"
          />
        </div>

        <div>
          <label className="label" htmlFor="unit">
            Unit
          </label>
          <select id="unit" name="unit" defaultValue={type?.unit ?? 'DAY'} className="input">
            <option value="DAY">Days</option>
            <option value="HOUR">Hours</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="maxDaysPerRequest">
            Max Per Request
          </label>
          <input
            id="maxDaysPerRequest"
            name="maxDaysPerRequest"
            type="number"
            min="1"
            defaultValue={type?.maxDaysPerRequest ?? ''}
            placeholder="No limit"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="colorHex">
            Colour
          </label>
          <input
            id="colorHex"
            name="colorHex"
            type="color"
            defaultValue={type?.colorHex ?? '#2563eb'}
            className="input h-[38px] p-1"
          />
        </div>

        <div className="flex flex-col justify-end gap-2 pb-1">
          <Checkbox
            name="requiresAllocation"
            label="Requires allocation"
            defaultChecked={type?.requiresAllocation ?? true}
          />
          <Checkbox
            name="requiresApproval"
            label="Requires approval"
            defaultChecked={type?.requiresApproval ?? true}
          />
          <Checkbox name="paid" label="Paid leave" defaultChecked={type?.paid ?? true} />
          <Checkbox name="active" label="Active" defaultChecked={type?.active ?? true} />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4">
        <SubmitButton label={type ? 'Save Type' : 'Create Type'} />
        <button type="button" onClick={onDone} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

function DeleteTypeButton({ id, inUse }: { id: string; inUse: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-medium text-red-600 hover:underline"
      >
        {inUse ? 'Archive' : 'Delete'}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteTimeOffTypeAction(id))}
        className="font-medium text-red-600 hover:underline"
      >
        {pending ? '…' : 'Confirm'}
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
