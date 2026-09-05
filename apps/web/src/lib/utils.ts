import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Domain calculations live in the shared package so the API and this client
// cannot drift; re-exported here so components have one import path.
export {
  round2,
  parseTimeToHours,
  lineHours,
  computeWeeklyHours,
  averageDayHours,
  workingDaysInRange,
  computeLeaveDuration,
  type ScheduleLineInput,
} from '@peoplepay360/shared';

export { DAY_NAMES, DAY_SHORT, CATEGORY_LABELS, isNegativeCategory } from '@peoplepay360/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CURRENCY = '₹';

export function formatMoney(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return `${CURRENCY}${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoneyShort(amount: number | null | undefined): string {
  const value = amount ?? 0;
  if (Math.abs(value) >= 10000000) return `${CURRENCY}${(value / 10000000).toFixed(2)}Cr`;
  if (Math.abs(value) >= 100000) return `${CURRENCY}${(value / 100000).toFixed(2)}L`;
  if (Math.abs(value) >= 1000) return `${CURRENCY}${(value / 1000).toFixed(1)}K`;
  return `${CURRENCY}${value.toFixed(0)}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatHours(hours: number | null | undefined): string {
  const v = hours ?? 0;
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Current month as YYYY-MM, the shape the API's month filter expects. */
export function toMonthInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** Split a "First Last" string for avatar initials. */
export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] ?? '', last: parts.length > 1 ? parts[parts.length - 1] : '' };
}

/** Deterministic avatar tint so the same person always renders the same colour. */
export function avatarColor(seed: string): string {
  const palette = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
