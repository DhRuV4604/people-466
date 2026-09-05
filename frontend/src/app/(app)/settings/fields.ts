import {
  MAX_CHECK_INS_PER_DAY,
  ROLES,
  ROLE_LABELS,
  SCHEDULE_TYPES,
} from "@peoplepay360/shared";

import type { FieldSpec, Refs } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

/**
 * The records the settings screen owns. Each is declared once: the page passes
 * the loaded reference lists, the server action calls the same function bare,
 * because reading a submission only needs the names and types.
 */

const ROLE_OPTIONS = ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export function departmentFields(): FieldSpec[] {
  return [
    { name: "name", label: "Name", required: true, span: "full" },
    {
      name: "code",
      label: "Code",
      clearable: true,
      placeholder: "ENG",
      span: "full",
    },
  ];
}

export function positionFields(): FieldSpec[] {
  return [{ name: "name", label: "Name", required: true, span: "full" }];
}

export function scheduleFields(): FieldSpec[] {
  return [
    { name: "name", label: "Name", required: true, span: "full" },
    {
      name: "scheduleType",
      label: "Type",
      type: "select",
      options: statusOptions(SCHEDULE_TYPES),
    },
    {
      // A save replaces the whole schedule, so leaving this blank would reset
      // the stored zone to UTC rather than keep it.
      name: "timezone",
      label: "Timezone",
      required: true,
      placeholder: "Europe/London",
      hint: "The zone the times below are read in.",
    },
    { name: "active", label: "Active", type: "switch" },
    /**
     * Weekly hours are derived by the API from these lines, so nothing here
     * sends hoursPerWeek. The week itself is edited by ScheduleLinesField,
     * which posts it as JSON through the form's extras slot.
     */
    { name: "lines", label: "Working days", type: "json", required: true },
  ];
}

/**
 * Organisation policy rather than a record, so there is no id and no name: the
 * form edits the one row the API keeps.
 */
export function attendancePolicyFields(): FieldSpec[] {
  return [
    {
      name: "maxCheckInsPerDay",
      label: "Check-ins per day",
      type: "number",
      required: true,
      min: 1,
      max: MAX_CHECK_INS_PER_DAY,
      step: 1,
      hint: "1 makes the punch card a once-a-day control. Raise it only for split shifts — an employee cannot check in again once the day's are used.",
    },
    {
      name: "warnOnCheckOut",
      label: "Warn before checking out",
      type: "switch",
      hint: "Asks the employee to confirm, naming how many check-ins they have left.",
    },
  ];
}
