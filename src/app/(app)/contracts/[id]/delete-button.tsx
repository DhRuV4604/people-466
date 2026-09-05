'use client';

import { useState, useTransition } from 'react';
import { deleteContractAction } from '../actions';

export function DeleteContractButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-danger">
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
      <span className="text-xs text-red-800">Delete “{name}”?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteContractAction(id))}
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
