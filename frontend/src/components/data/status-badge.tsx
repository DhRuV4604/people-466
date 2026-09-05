import * as React from "react";

import { statusMeta, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

const TONE: Record<Tone, string> = {
  positive:
    "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  danger: "border-transparent bg-destructive/10 text-destructive",
  accent: "border-transparent bg-primary/10 text-primary",
  neutral: "border-border text-muted-foreground",
};

/**
 * Renders any status constant the API returns. The label and colour come from
 * one vocabulary, so the same state never looks different on two screens.
 */
export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const { label, tone } = statusMeta(value);

  return (
    <span
      data-status={value}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

/** A dot for dense rows where a full badge would be noise. */
export function StatusDot({ value }: { value: string }) {
  const { label, tone } = statusMeta(value);
  const colour: Record<Tone, string> = {
    positive: "bg-emerald-500",
    pending: "bg-amber-500",
    danger: "bg-destructive",
    accent: "bg-primary",
    neutral: "bg-muted-foreground/40",
  };

  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
      <span className={cn("size-1.5 rounded-full", colour[tone])} />
      {label}
    </span>
  );
}
