"use client";

import * as React from "react";

/**
 * Lets a detail page name its own last crumb.
 *
 * Record ids are opaque cuids, so the trail alone can only say "Payslip". The
 * page knows the record, but the trail is a client component that sees nothing
 * but the URL — so the page publishes the name here and the trail reads it.
 * With the trail now the only way back out of a detail screen, it is worth it
 * saying which record you are on.
 *
 * A store rather than plain context because the two live in different parts of
 * the tree: the trail is in the layout's header, the page is its child, and a
 * child cannot provide context to an ancestor.
 */

type Listener = () => void;

let current: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

/** The server has no page mounted yet, so the trail falls back to its own label. */
function getServerSnapshot(): string | null {
  return null;
}

/** The title the current detail page published, or null on every other page. */
export function useBreadcrumbTitle(): string | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Renders nothing. Drop it on a detail page to name that page's crumb:
 *
 *   <BreadcrumbTitle>{employee.fullName}</BreadcrumbTitle>
 */
export function BreadcrumbTitle({ children }: { children: string }) {
  React.useEffect(() => {
    current = children;
    emit();
    // Cleared on the way out so the next page cannot inherit this one's name
    // while its own data is still loading.
    return () => {
      if (current === children) {
        current = null;
        emit();
      }
    };
  }, [children]);

  return null;
}
