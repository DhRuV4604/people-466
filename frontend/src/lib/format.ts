import type { EmployeeStatus, EmployeeType } from "@peoplepay360/shared";

/**
 * Display labels and formatting. The API speaks in enum constants; screens
 * speak in sentences, and this is the one place that translates between them.
 */

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  INACTIVE: "Inactive",
};

/** Badge tone per status, so a colour means the same thing on every screen. */
export const EMPLOYEE_STATUS_TONE: Record<
  EmployeeStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTIVE: "secondary",
  ON_LEAVE: "outline",
  INACTIVE: "destructive",
};

/** Two letters from a display name, for avatars with no photo. */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Dates arrive as ISO strings. Rendered in a fixed locale so server and
 *  client agree and hydration does not mismatch. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function pluralise(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

// ---------------------------------------------------------------- Money & numbers

/** The PDF renderer uses "Rs.", so the screens match it. */
const MONEY = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `Rs. ${MONEY.format(value)}`;
}

/** Compact form for tiles, where the exact rupee does not change a decision. */
export function moneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

export function hours(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}h`;
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

export function dateRange(from: string, to: string | null): string {
  return to ? `${formatDate(from)} – ${formatDate(to)}` : `${formatDate(from)} – open`;
}

/** Date and time together, for attendance punches. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}
