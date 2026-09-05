"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Reads design token values. The browser reports computed colours as lab(),
 * which is accurate but unreadable, so this walks the stylesheets for the
 * authored declaration first and only falls back to the computed value.
 */
function readAuthoredToken(name: string): string | undefined {
  const visit = (rules: CSSRuleList): string | undefined => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
        const value = rule.style.getPropertyValue(name).trim();
        if (value) return value;
      }
      const nested = (rule as CSSGroupingRule).cssRules;
      if (nested) {
        const found = visit(nested);
        if (found) return found;
      }
    }
    return undefined;
  };

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Cross-origin stylesheet, nothing to read.
    }
    const found = visit(rules);
    if (found) return found;
  }
  return undefined;
}

export function useTokenValues(names: string[]) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  // Token lists are literals per call site, so joining gives a stable dep and
  // lets the effect rebuild the list without closing over the array itself.
  const key = names.join(",");

  React.useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const name of key.split(",")) {
      next[name] =
        readAuthoredToken(name) || computed.getPropertyValue(name).trim();
    }
    // Resolved CSS is browser state, not React state: the values only exist
    // once the stylesheet has been applied, so an effect is the earliest we
    // can read them. This runs once per token list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next);
  }, [key]);

  return values;
}

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-border pt-12">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

/**
 * One example. `title` names the component, `use` says when to reach for it,
 * and the framed area holds the live thing rather than a code listing.
 */
export function Example({
  title,
  use,
  children,
  className,
}: {
  title: string;
  use?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {use ? (
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
          {use}
        </p>
      ) : null}
      <div
        className={cn(
          "mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/30 p-6",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A colour chip with its token name and the value resolved at runtime. */
export function Swatch({
  token,
  value,
  border,
}: {
  token: string;
  value?: string;
  border?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={cn(
          "h-16 rounded-lg",
          border ? "border border-border" : "ring-1 ring-black/5",
        )}
        style={{ background: `var(${token})` }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs">{token}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export function SwatchGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}
