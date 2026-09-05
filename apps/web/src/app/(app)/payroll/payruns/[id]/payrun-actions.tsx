'use client';

import { useState, useTransition } from 'react';
import {
  computePayrunAction,
  validatePayrunAction,
  markPayrunPaidAction,
  sendPayslipsAction,
  deletePayrunAction,
} from '../../actions';

export function PayrunActions({
  id,
  status,
  canUpdate,
  canDelete,
  hasPayslips,
}: {
  id: string;
  status: string;
  canUpdate: boolean;
  canDelete: boolean;
  hasPayslips: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.');
      }
    });
  };

  const send = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await sendPayslipsAction(id);
        setNotice(
          `Sent ${result.sent} payslip(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}.`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send payslips.');
      }
    });
  };

  const isPaid = status === 'PAID';

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canUpdate && !isPaid && hasPayslips && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => computePayrunAction(id))}
            className="btn-secondary"
          >
            {pending ? 'Working…' : status === 'DRAFT' ? 'Compute' : 'Recompute'}
          </button>
        )}

        {canUpdate && (status === 'COMPUTED' || status === 'VALIDATED') && (
          <button
            type="button"
            disabled={pending || status === 'VALIDATED'}
            onClick={() => run(() => validatePayrunAction(id))}
            className="btn-secondary"
          >
            {status === 'VALIDATED' ? 'Validated' : 'Validate'}
          </button>
        )}

        {canUpdate && status === 'VALIDATED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markPayrunPaidAction(id))}
            className="btn-success"
          >
            Mark Paid
          </button>
        )}

        {canUpdate && hasPayslips && status !== 'DRAFT' && (
          <button type="button" disabled={pending} onClick={send} className="btn-primary">
            {pending ? 'Sending…' : 'Send Payslips'}
          </button>
        )}

        {canDelete && !isPaid && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="btn-danger"
          >
            Delete
          </button>
        )}

        {confirmingDelete && (
          <span className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
            <span className="text-xs text-red-800">Delete this pay run?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deletePayrunAction(id))}
              className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {error && (
        <p className="max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-right text-xs text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </p>
      )}
    </div>
  );
}
