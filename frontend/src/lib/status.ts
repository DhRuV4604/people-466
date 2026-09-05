/**
 * The whole status vocabulary, in one place.
 *
 * Every enum the API returns gets a human label and a tone. Screens never
 * write their own, so "Approved" is the same word and the same colour whether
 * it appears on a leave request, an allocation or a pay run.
 *
 * Tones: `positive` means done or healthy, `pending` means waiting on someone,
 * `danger` means failed or blocking, `neutral` means informational.
 */

export type Tone = "positive" | "pending" | "danger" | "neutral" | "accent";

export type StatusMeta = { label: string; tone: Tone };

const STATUS: Record<string, StatusMeta> = {
  // Employees
  ACTIVE: { label: "Active", tone: "positive" },
  ON_LEAVE: { label: "On leave", tone: "pending" },
  INACTIVE: { label: "Inactive", tone: "neutral" },

  // Employment type
  FULL_TIME: { label: "Full time", tone: "neutral" },
  PART_TIME: { label: "Part time", tone: "neutral" },
  INTERN: { label: "Intern", tone: "neutral" },

  // Contracts
  DRAFT: { label: "Draft", tone: "neutral" },
  RUNNING: { label: "Running", tone: "positive" },
  EXPIRED: { label: "Expired", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  PERMANENT: { label: "Permanent", tone: "neutral" },
  FIXED_TERM: { label: "Fixed term", tone: "neutral" },
  INTERNSHIP: { label: "Internship", tone: "neutral" },
  FREELANCE: { label: "Freelance", tone: "neutral" },

  // Attendance
  PRESENT: { label: "Present", tone: "positive" },
  LATE: { label: "Late", tone: "pending" },
  ABSENT: { label: "Absent", tone: "danger" },
  MISSING_CHECKOUT: { label: "No check-out", tone: "danger" },
  HALF_DAY: { label: "Half day", tone: "pending" },

  // Time off
  TO_APPROVE: { label: "To approve", tone: "pending" },
  APPROVED: { label: "Approved", tone: "positive" },
  REFUSED: { label: "Refused", tone: "danger" },

  // Payroll
  COMPUTED: { label: "Computed", tone: "accent" },
  VALIDATED: { label: "Validated", tone: "accent" },
  PAID: { label: "Paid", tone: "positive" },

  // Email
  QUEUED: { label: "Queued", tone: "pending" },
  SENT: { label: "Sent", tone: "positive" },
  FAILED: { label: "Failed", tone: "danger" },

  // Salary rules
  BASIC: { label: "Basic", tone: "neutral" },
  ALLOWANCE: { label: "Allowance", tone: "positive" },
  GROSS: { label: "Gross", tone: "accent" },
  DEDUCTION: { label: "Deduction", tone: "danger" },
  CONTRIBUTION: { label: "Contribution", tone: "danger" },
  NET: { label: "Net", tone: "accent" },

  // Compute types
  FIXED: { label: "Fixed", tone: "neutral" },
  PERCENTAGE: { label: "Percentage", tone: "neutral" },
  FORMULA: { label: "Formula", tone: "neutral" },

  // Leave units
  DAY: { label: "Days", tone: "neutral" },
  HOUR: { label: "Hours", tone: "neutral" },

  // Contract / schedule
  FLEXIBLE: { label: "Flexible", tone: "neutral" },
};

/** Falls back to title-casing an unknown constant rather than showing SNAKE_CASE. */
export function statusMeta(value: string): StatusMeta {
  return (
    STATUS[value] ?? {
      label:
        value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " "),
      tone: "neutral",
    }
  );
}

export function statusLabel(value: string): string {
  return statusMeta(value).label;
}

/** Options for a filter select, labelled from the same vocabulary. */
export function statusOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: statusLabel(value) }));
}
