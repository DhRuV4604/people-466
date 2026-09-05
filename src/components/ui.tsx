import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn, initials, avatarColor } from '@/lib/utils';

// ---------------------------------------------------------------- Status badges

const STATUS_STYLES: Record<string, string> = {
  // Generic / employee
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  ON_LEAVE: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  // Contract
  DRAFT: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  RUNNING: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  EXPIRED: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  // Attendance
  PRESENT: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  LATE: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  ABSENT: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  MISSING_CHECKOUT: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  HALF_DAY: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  // Leave / payroll
  TO_APPROVE: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REFUSED: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  COMPUTED: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  VALIDATED: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  PAID: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('badge', STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT, className)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode;
  tone?: 'slate' | 'violet' | 'emerald' | 'amber' | 'red' | 'blue';
  className?: string;
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    violet: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  };
  return <span className={cn('badge', tones[tone], className)}>{children}</span>;
}

// ---------------------------------------------------------------- Avatar

export function Avatar({
  firstName,
  lastName,
  size = 'md',
  seed,
}: {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  seed?: string;
}) {
  const sizes = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
    xl: 'h-20 w-20 text-xl',
  };
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
        avatarColor(seed ?? `${firstName}${lastName}`)
      )}
    >
      {initials(firstName, lastName)}
    </div>
  );
}

// ---------------------------------------------------------------- Page furniture

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">/</span>}
              <Link href={crumb.href} className="hover:text-brand-600 hover:underline">
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Smart buttons

/** Employee-form smart button: a count plus a link into the filtered related list. */
export function SmartButton({
  href,
  label,
  count,
  icon,
}: {
  href: string;
  label: string;
  count: number | string;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-[112px] flex-col items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 transition hover:border-brand-300 hover:bg-brand-50"
    >
      <span className="flex items-center gap-1.5 text-lg font-bold text-slate-900 group-hover:text-brand-700">
        {icon}
        {count}
      </span>
      <span className="text-xs font-medium text-slate-500 group-hover:text-brand-600">{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------- Data display

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="label">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children ?? '—'}</dd>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sublabel,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  icon?: ReactNode;
}) {
  const tones = {
    default: 'text-slate-900',
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="text-slate-300">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tracking-tight', tones[tone])}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}

export function AlertBanner({
  tone = 'warning',
  title,
  items,
}: {
  tone?: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  const tones = {
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };

  return (
    <div className={cn('rounded-xl border p-4', tones[tone])}>
      <p className="mb-1.5 text-sm font-semibold">{title}</p>
      <ul className="space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal progress bar used for leave balances and attendance health. */
export function ProgressBar({
  value,
  max,
  colorHex,
  className,
}: {
  value: number;
  max: number;
  colorHex?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: colorHex ?? '#7c3aed' }}
      />
    </div>
  );
}

export function Tabs({
  tabs,
  active,
}: {
  tabs: { label: string; href: string; count?: number }[];
  active: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              '-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
