'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui';
import type { ActionState } from './actions';

export interface EntityItem {
  id: string;
  name: string;
  code?: string | null;
  usageCount: number;
  usageLabel: string;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary btn-sm" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

/** Shared CRUD surface for the small config entities (departments, positions). */
export function SimpleEntityManager({
  entityLabel,
  items,
  canManage,
  canDelete,
  showCode = false,
  saveAction,
  deleteAction,
}: {
  entityLabel: string;
  items: EntityItem[];
  canManage: boolean;
  canDelete: boolean;
  showCode?: boolean;
  saveAction: (prev: ActionState | null, form: FormData) => Promise<ActionState>;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<EntityItem | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {canManage && !creating && !editing && (
        <div className="mb-4">
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            New {entityLabel}
          </button>
        </div>
      )}

      {(creating || editing) && (
        <EntityForm
          entityLabel={entityLabel}
          item={editing ?? undefined}
          showCode={showCode}
          saveAction={saveAction}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              {showCode && <th>Code</th>}
              <th>Usage</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="font-medium text-slate-900">{item.name}</td>
                {showCode && <td className="font-mono text-xs">{item.code ?? '—'}</td>}
                <td>
                  <Badge tone={item.usageCount > 0 ? 'violet' : 'slate'}>
                    {item.usageCount} {item.usageLabel}
                  </Badge>
                </td>
                {canManage && (
                  <td>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(item);
                          setCreating(false);
                        }}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      {canDelete && (
                        <DeleteEntityButton id={item.id} deleteAction={deleteAction} />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                  No {entityLabel.toLowerCase()}s yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EntityForm({
  entityLabel,
  item,
  showCode,
  saveAction,
  onDone,
}: {
  entityLabel: string;
  item?: EntityItem;
  showCode: boolean;
  saveAction: (prev: ActionState | null, form: FormData) => Promise<ActionState>;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveAction, null);

  if (state?.success) setTimeout(onDone, 0);

  return (
    <form action={formAction} className="card mb-4 p-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        {item ? `Edit ${item.name}` : `New ${entityLabel}`}
      </h3>

      {state?.error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="name">
            Name <span className="text-red-500">*</span>
          </label>
          <input id="name" name="name" defaultValue={item?.name} required className="input" />
        </div>

        {showCode && (
          <div className="w-32">
            <label className="label" htmlFor="code">
              Code
            </label>
            <input
              id="code"
              name="code"
              defaultValue={item?.code ?? ''}
              className="input font-mono uppercase"
            />
          </div>
        )}

        <div className="flex items-center gap-2 pb-0.5">
          <SubmitButton label={item ? 'Save' : 'Create'} />
          <button type="button" onClick={onDone} className="btn-secondary btn-sm">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function DeleteEntityButton({
  id,
  deleteAction,
}: {
  id: string;
  deleteAction: (id: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <span className="text-[11px] text-red-600" title={error}>
        {error}
      </span>
    );
  }

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
        onClick={() =>
          startTransition(async () => {
            try {
              await deleteAction(id);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed.');
            }
          })
        }
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
