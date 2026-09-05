'use client';

import { useState, useTransition } from 'react';
import {
  approveAllocationAction,
  refuseAllocationAction,
  deleteAllocationAction,
} from '../../actions';

export function AllocationActions({
  id,
  status,
  canApprove,
  canDelete,
}: {
  id: string;
  status: string;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</span>
      )}

      {canApprove && status !== 'APPROVED' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveAllocationAction(id))}
          className="btn-success"
        >
          {pending ? 'Working…' : 'Approve'}
        </button>
      )}

      {canApprove && status !== 'REFUSED' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => refuseAllocationAction(id))}
          className="btn-danger"
        >
          Refuse
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteAllocationAction(id))}
          className="btn-secondary"
        >
          Delete
        </button>
      )}
    </div>
  );
}
