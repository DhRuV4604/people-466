import * as React from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The small pieces every module screen is assembled from. Keeping them here
 * means a stat tile, an empty state or a section heading looks the same in
 * payroll as it does in attendance.
 */

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "accent" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        tone === "accent" && "border-primary/30 bg-primary/[0.03]",
        tone === "danger" && "border-destructive/30 bg-destructive/[0.03]",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight tabular-nums",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function StatGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  /**
   * How many fit on a wide screen. Four is the usual; five is for a row that
   * has one more thing worth saying than it has room for at four.
   */
  columns?: 4 | 5;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        columns === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-16 text-center">
      <Icon className="size-7 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

/** Label and value, the unit every detail panel is built from. */
export function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children ?? "—"}</dd>
    </div>
  );
}

export function FactGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {children}
    </dl>
  );
}

/** A person, rendered the same way in every list. */
export function PersonCell({
  name,
  meta,
  href,
}: {
  name: string;
  meta?: string | null;
  href?: string;
}) {
  const body = (
    <>
      <span className="block truncate font-medium">{name}</span>
      {meta ? (
        <span className="block truncate text-xs text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </>
  );

  return href ? (
    <Link href={href} className="block min-w-0 hover:underline">
      {body}
    </Link>
  ) : (
    <div className="min-w-0">{body}</div>
  );
}
