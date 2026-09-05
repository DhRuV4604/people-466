'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';

export function DashboardFilters({
  departments,
  month,
  department,
  type,
}: {
  departments: { id: string; name: string }[];
  month: string;
  department: string;
  type: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const params = new URLSearchParams({ month, department, type });
    if (value) params.set(key, value);
    else params.delete(key);

    // Drop empty values so the URL stays readable.
    for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);

    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[160px]">
        <label className="label" htmlFor="month">
          Period
        </label>
        <input
          id="month"
          type="month"
          value={month}
          onChange={(e) => update('month', e.target.value)}
          className="input"
        />
      </div>

      <div className="min-w-[180px]">
        <label className="label" htmlFor="department">
          Department
        </label>
        <select
          id="department"
          value={department}
          onChange={(e) => update('department', e.target.value)}
          className="input"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[170px]">
        <label className="label" htmlFor="type">
          Employee Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => update('type', e.target.value)}
          className="input"
        >
          <option value="">All types</option>
          <option value="FULL_TIME">Full time</option>
          <option value="PART_TIME">Part time</option>
          <option value="CONTRACT">Contract</option>
          <option value="INTERN">Intern</option>
        </select>
      </div>

      {(department || type) && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push(`${pathname}?month=${month}`))}
          className="btn-secondary"
        >
          Clear filters
        </button>
      )}

      {pending && <span className="pb-2 text-xs text-slate-400">Updating…</span>}
    </div>
  );
}
