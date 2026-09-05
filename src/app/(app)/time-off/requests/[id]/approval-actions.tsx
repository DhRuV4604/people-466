'use client';

import { useState, useTransition } from 'react';
import {
  approveLeaveRequestAction,
  refuseLeaveRequestAction,
  cancelLeaveRequestAction,
  deleteLeaveRequestAction,
} from '../../actions';

export function ApprovalActions({
  id,
  status,
  canApprove,
  canDelete,
  canCancel,
}: {
  id: string;
  status: string;
  canApprove: boolean;
  canDelete: boolean;
  canCancel: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
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

  if (refusing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for refusal…"
          className="input w-56 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => refuseLeaveRequestAction(id, reason))}
          className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
        >
          {pending ? 'Refusing…' : 'Confirm Refusal'}
        </button>
        <button type="button" onClick={() => setRefusing(false)} className="btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</span>
      )}

      {canApprove && status === 'TO_APPROVE' && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveLeaveRequestAction(id))}
            className="btn-success"
          >
            {pending ? 'Working…' : 'Approve'}
          </button>
          <button type="button" onClick={() => setRefusing(true)} className="btn-danger">
            Refuse
          </button>
        </>
      )}

      {canApprove && status === 'REFUSED' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveLeaveRequestAction(id))}
          className="btn-success"
        >
          Approve Instead
        </button>
      )}

      {canCancel && status !== 'CANCELLED' && status !== 'REFUSED' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => cancelLeaveRequestAction(id))}
          className="btn-secondary"
        >
          Cancel Request
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteLeaveRequestAction(id))}
          className="btn-danger"
        >
          Delete
        </button>
      )}
    </div>
  );
}
