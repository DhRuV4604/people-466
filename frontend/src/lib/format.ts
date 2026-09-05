import type {
  DocumentKind,
  DocumentStatus,
  EmployeeStatus,
  EmployeeType,
} from "@peoplepay360/shared";

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

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  JOINING_LETTER: "Joining letter",
  OFFER_LETTER: "Offer letter",
  NDA: "NDA",
  CONTRACT: "Contract",
  POLICY: "Policy",
  ID_PROOF: "ID proof",
  ADDRESS_PROOF: "Address proof",
  QUALIFICATION: "Qualification",
  OTHER: "Other",
};

/**
 * Worded from the reader's side rather than the database's. "Awaiting
 * signature" is what HR is waiting for; the employee sees the same row and
 * needs to know it is waiting on them, which is what the copy on their own
 * screen says instead.
 */
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: "Draft",
  REQUESTED: "Requested",
  AWAITING_SIGNATURE: "Awaiting signature",
  SUBMITTED: "On file",
  SIGNED: "Signed",
  DECLINED: "Declined",
  CANCELLED: "Withdrawn",
};

export const DOCUMENT_STATUS_TONE: Record<
  DocumentStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "outline",
  REQUESTED: "default",
  AWAITING_SIGNATURE: "default",
  SUBMITTED: "secondary",
  SIGNED: "secondary",
  DECLINED: "destructive",
  CANCELLED: "outline",
};

/** Human file size, for a list where the number is a hint and not a fact. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

/**
 * Day and clock time together, for an audit trail.
 *
 * UTC, and said so: a certificate that reports the signing time in whatever
 * zone the reader happens to be in is a certificate two people can disagree
 * about.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)} UTC`;
}
