'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export interface SelectFilter {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label?: string;
}

/**
 * Shared filter bar for list views. Existing query params are preserved so
 * context links (e.g. ?employee=<id> from a smart button) survive filtering.
 */
export function ListFilters({
  search,
  selects = [],
  dateRange,
}: {
  search?: { value: string; placeholder: string };
  selects?: SelectFilter[];
  dateRange?: { from: string; to: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(search?.value ?? '');

  const push = (overrides: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const hasActiveFilter =
    selects.some((s) => s.value) || Boolean(search?.value) || Boolean(dateRange?.from);

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      {search && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            push({ q });
          }}
          className="min-w-[220px] flex-1"
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={search.placeholder}
            className="input"
          />
        </form>
      )}

      {dateRange && (
        <>
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              type="date"
              value={dateRange.from}
              onChange={(e) => push({ from: e.target.value })}
              className="input w-auto"
            />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              type="date"
              value={dateRange.to}
              onChange={(e) => push({ to: e.target.value })}
              className="input w-auto"
            />
          </div>
        </>
      )}

      {selects.map((s) => (
        <div key={s.name}>
          {s.label && (
            <label className="label" htmlFor={s.name}>
              {s.label}
            </label>
          )}
          <select
            id={s.name}
            value={s.value}
            onChange={(e) => push({ [s.name]: e.target.value })}
            className="input w-auto min-w-[150px]"
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => {
            setQ('');
            // Keep the record-scoping param so smart-button context is not lost.
            const employee = searchParams.get('employee');
            const params = new URLSearchParams();
            if (employee) params.set('employee', employee);
            startTransition(() => router.push(`${pathname}?${params.toString()}`));
          }}
          className="btn-secondary"
        >
          Clear
        </button>
      )}

      {pending && <span className="pb-2 text-xs text-slate-400">Loading…</span>}
    </div>
  );
}
