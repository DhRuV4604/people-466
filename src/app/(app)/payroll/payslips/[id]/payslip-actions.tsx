'use client';

import { useState, useTransition } from 'react';
import { recomputePayslipAction } from '../../actions';

export function PayslipActions({
  id,
  status,
  canRecompute,
}: {
  id: string;
  status: string;
  canRecompute: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canRecompute && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await recomputePayslipAction(id);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to recompute.');
                }
              })
            }
            className="btn-secondary"
          >
            {pending ? 'Recomputing…' : 'Recompute'}
          </button>
        )}

        {/* Server-generated PDF, opened in a new tab for download or printing. */}
        <a
          href={`/api/payslips/${id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Print Payslip (PDF)
        </a>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
