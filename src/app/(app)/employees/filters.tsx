'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

export function EmployeeFilters({
  departments,
  view,
  q,
  department,
  type,
  status,
}: {
  departments: { id: string; name: string }[];
  view: string;
  q: string;
  department: string;
  type: string;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);

  const push = (overrides: Record<string, string>) => {
    const next = { view, q: search, department, type, status, ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      {/* View switcher */}
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
        {(['kanban', 'list'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => push({ view: v })}
            className={cn(
              'px-3 py-2 text-sm font-medium capitalize transition',
              view === v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: search });
        }}
        className="min-w-[200px] flex-1"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or code…"
          className="input"
        />
      </form>

      <select
        value={department}
        onChange={(e) => push({ department: e.target.value })}
        className="input w-auto min-w-[160px]"
      >
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <select
        value={type}
        onChange={(e) => push({ type: e.target.value })}
        className="input w-auto min-w-[140px]"
      >
        <option value="">All types</option>
        <option value="FULL_TIME">Full time</option>
        <option value="PART_TIME">Part time</option>
        <option value="CONTRACT">Contract</option>
        <option value="INTERN">Intern</option>
      </select>

      <select
        value={status}
        onChange={(e) => push({ status: e.target.value })}
        className="input w-auto min-w-[130px]"
      >
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="ON_LEAVE">On leave</option>
        <option value="INACTIVE">Inactive</option>
      </select>

      {pending && <span className="pb-2 text-xs text-slate-400">Loading…</span>}
    </div>
  );
}
