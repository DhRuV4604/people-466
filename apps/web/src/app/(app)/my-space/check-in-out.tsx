'use client';

import { useState, useTransition } from 'react';
import { formatTime } from '@/lib/utils';
import { checkInAction, checkOutAction } from '../attendance/actions';

export function CheckInOut({
  openEntry,
}: {
  openEntry: { id: string; checkIn: string } | null;
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
    <div className="flex flex-col items-end gap-2">
      {openEntry ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Checked in
            </p>
            <p className="font-mono text-sm font-bold text-emerald-900">
              {formatTime(new Date(openEntry.checkIn))}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(checkOutAction)}
            className="btn-primary"
          >
            {pending ? 'Checking out…' : 'Check Out'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(checkInAction)}
          className="btn-success"
        >
          {pending ? 'Checking in…' : 'Check In'}
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
