'use client';

import { useState, useTransition } from 'react';
import { deleteScheduleAction } from '../../actions';

export function DeleteScheduleButton({ id }: { id: string }) {
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
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
      {error ? (
        <span className="text-xs text-red-700">{error}</span>
      ) : (
        <span className="text-xs text-red-800">Delete this schedule?</span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await deleteScheduleAction(id);
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
    </div>
  );
}
