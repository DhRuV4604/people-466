'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStructureAction, deleteStructureAction } from '../actions';

export interface StructureValues {
  id?: string;
  name?: string;
  code?: string;
  description?: string | null;
  active?: boolean;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function StructureForm({
  structure,
  readOnly = false,
  canDelete = false,
}: {
  structure?: StructureValues;
  readOnly?: boolean;
  canDelete?: boolean;
}) {
  const [state, formAction] = useActionState(saveStructureAction, null);

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Structure Details</h3>

      <form action={formAction} className="space-y-4">
        {structure?.id && <input type="hidden" name="id" value={structure.id} />}

        {state?.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        )}

        <div>
          <label className="label" htmlFor="name">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            defaultValue={structure?.name}
            required
            disabled={readOnly}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="code">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            name="code"
            defaultValue={structure?.code}
            required
            disabled={readOnly}
            placeholder="REG"
            className="input font-mono uppercase"
          />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={structure?.description ?? ''}
            disabled={readOnly}
            className="input"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={structure?.active ?? true}
            disabled={readOnly}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Active
        </label>

        {!readOnly && (
          <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
            <SubmitButton label={structure?.id ? 'Save' : 'Create Structure'} />
            {structure?.id && canDelete && <DeleteStructureButton id={structure.id} />}
          </div>
        )}
      </form>
    </div>
  );
}

function DeleteStructureButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-danger">
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await deleteStructureAction(id);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed.');
            }
          })
        }
        className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
      >
        {pending ? 'Deleting…' : 'Confirm'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="btn-secondary btn-sm">
        Cancel
      </button>
    </span>
  );
}
