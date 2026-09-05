import { ROLE_LABELS, type AuditAction } from "@peoplepay360/shared";

import { formatDate, formatTime, money } from "@/lib/format";
import { statusLabel } from "@/lib/status";

/**
 * The words and colours the trail is read in.
 *
 * Kept out of the components so the page can label its filters from the same
 * vocabulary the rows use, and so a diff never shows a raw column name or a
 * raw ISO string.
 */

/** "LeaveRequest" to "Leave request", "date_start" to "Date start". */
function humanise(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : // An acronym keeps its case; every other word is mid-sentence.
          word === word.toUpperCase()
          ? word
          : word.toLowerCase(),
    )
    .join(" ");
}

/**
 * The models the trail records, named as the product names them rather than
 * as Prisma does.
 */
const ENTITY_LABELS: Record<string, string> = {
  Employee: "Employee",
  Contract: "Contract",
  Attendance: "Attendance",
  LeaveRequest: "Time off request",
  LeaveAllocation: "Allocation",
  TimeOffType: "Time off type",
  WorkingSchedule: "Working schedule",
  Payrun: "Pay run",
  Payslip: "Payslip",
  SalaryStructure: "Salary structure",
  SalaryRule: "Salary rule",
  Department: "Department",
  JobPosition: "Job position",
  User: "User",
};

/** Offered in the entity filter, in the order the product is used. */
export const AUDITED_ENTITIES = Object.keys(ENTITY_LABELS);

/** Falls back to splitting the model name, since `entity` is free text and a
 *  new resource becomes auditable without anything here changing. */
export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? humanise(entity);
}

/**
 * A relation column names the thing, not its id: "employeeId" is "Employee".
 * Only a real suffix counts - a lowercase "id" is often the end of a word, and
 * the schema has a `paid` flag that would otherwise be labelled "Pa".
 */
export function fieldLabel(field: string): string {
  return humanise(field.replace(/_id$/, "").replace(/([a-z0-9])Id$/, "$1") || field);
}

/** Checked before money, because "amountPercentage" is named for the money it
 *  applies to and reading it as rupees changes what the row means. */
const PERCENT_FIELD = /percent/i;
const MONEY_FIELD = /wage|amount|salary|gross|net|total|basic|balance|cost|price/i;
const HOURS_FIELD = /hours/i;
const ROLE_FIELD = /^(?:user)?role$/i;
/** A code is not an enum. "HRA" is a salary rule, "HDFC" is a bank and "UTC"
 *  is a zone; read as statuses they become "Hra", "Hdfc" and "Utc". */
const CODE_FIELD = /code|number|bank|ifsc|iban|pan|zone/i;

const NUMERIC = /^-?\d+(?:\.\d+)?$/;
const ISO = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/;
/** Letters and underscores only, so an account number or a code is not
 *  mistaken for one of the API's enum constants. */
const CONSTANT = /^[A-Z][A-Z_]{2,}$/;

const NUMBER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
/** A rate is stored to four places, and rounding one hides what changed. */
const RATE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 });

/** What an absent value reads as, wherever one turns up. */
export const NOTHING = "—";

/**
 * A stored value as a person reads it, decided by what the field holds. A diff
 * showing `true`, `null` or `2026-03-01T00:00:00.000Z` is a diff nobody checks.
 */
export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return NOTHING;
  if (typeof value === "boolean") return value ? "Yes" : "No";

  const isPercent = PERCENT_FIELD.test(field);
  const isMoney = !isPercent && MONEY_FIELD.test(field);
  const isHours = !isPercent && !isMoney && HOURS_FIELD.test(field);

  const asNumber = (n: number): string =>
    isPercent
      ? `${RATE.format(n)}%`
      : isMoney
        ? money(n)
        : // Not lib/format's `hours`: it rounds to one place, and two hours
          // stored a hundredth apart would then read as the same number on
          // either side of an arrow.
          `${NUMBER.format(n)}${isHours ? "h" : ""}`;

  if (typeof value === "number") return asNumber(value);

  if (typeof value === "string") {
    // A Decimal column crosses the wire as a string, so the numeric tests have
    // to run before the value is taken for text.
    if ((isPercent || isMoney || isHours) && NUMERIC.test(value)) {
      return asNumber(Number(value));
    }

    // A role has a vocabulary of its own, and read as a status it comes out
    // "Hr payroll manager".
    const role = (ROLE_LABELS as Record<string, string>)[value];
    if (role && ROLE_FIELD.test(field)) return role;

    // A status change is the most common edit there is, and it is worth
    // nothing if it reads "TO_APPROVE" instead of "To approve".
    if (CONSTANT.test(value) && !CODE_FIELD.test(field)) return statusLabel(value);

    if (ISO.test(value)) {
      const time = formatTime(value);
      // Midnight is a date the database stores as a timestamp, not a time
      // anyone chose, so it is not worth a line of its own.
      return time === "00:00" ? formatDate(value) : `${formatDate(value)}, ${time}`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => formatValue(field, item)).join(", ")
      : NOTHING;
  }

  return JSON.stringify(value);
}

const DANGER = "border-transparent bg-destructive/10 text-destructive";
const ACCENT = "border-transparent bg-primary/10 text-primary";
const POSITIVE =
  "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

/**
 * Enough separation that a delete never reads like an edit. The actions left
 * out keep the badge's neutral tone, because nothing was created or lost.
 */
export const ACTION_TONE: Partial<Record<AuditAction, string>> = {
  CREATE: POSITIVE,
  UPDATE: ACCENT,
  DELETE: DANGER,
  APPROVE: POSITIVE,
  REFUSE: DANGER,
  COMPUTE: ACCENT,
  VALIDATE: ACCENT,
  PAY: POSITIVE,
};
