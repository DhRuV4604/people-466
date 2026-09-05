'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { logoutAction } from '@/app/login/actions';
import type { Role } from '@/lib/rbac';
import { ROLE_LABELS } from '@/lib/rbac';

export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

export function TopNav({
  items,
  user,
}: {
  items: NavItem[];
  user: { name: string; email: string; role: Role };
}) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            P
          </div>
          <span className="hidden text-sm font-bold tracking-tight text-slate-900 sm:block">
            PeoplePay360
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          {items.map((item) => {
            const active = isActive(item.href);

            if (!item.children) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setOpenMenu(item.href)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === item.href ? null : item.href)}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {item.label}
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openMenu === item.href && (
                  <div className="absolute left-0 top-full w-56 pt-1">
                    <div className="rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpenMenu(null)}
                          className={cn(
                            'block px-3.5 py-2 text-sm transition',
                            pathname === child.href
                              ? 'bg-brand-50 font-medium text-brand-700'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserOpen(!userOpen)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-100"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {user.name.charAt(0)}
              </div>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-semibold leading-tight text-slate-900">
                  {user.name}
                </span>
                <span className="block text-[10px] leading-tight text-slate-500">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
            </button>

            {userOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  <div className="border-b border-slate-100 px-3.5 py-2">
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                      {ROLE_LABELS[user.role]}
                    </p>
                  </div>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="w-full px-3.5 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            aria-label="Toggle navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
          {items.map((item) => (
            <div key={item.href} className="py-0.5">
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium',
                  isActive(item.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
                )}
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="ml-3 border-l border-slate-200 pl-3">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-3 py-1.5 text-sm text-slate-600"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
