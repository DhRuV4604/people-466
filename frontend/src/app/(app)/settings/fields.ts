import { ROLES, ROLE_LABELS, SCHEDULE_TYPES } from "@peoplepay360/shared";

import type { FieldSpec, Refs } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

/**
 * The four records the settings screen owns. Each is declared once: the page
 * passes the loaded reference lists, the server action calls the same function
 * bare, because reading a submission only needs the names and types.
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

export function userFields(refs?: Partial<Refs>): FieldSpec[] {
  return [
    { name: "name", label: "Name", required: true },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "name@company.com",
      autoComplete: "off",
    },
    {
      name: "role",
      label: "Role",
      type: "select",
      required: true,
      options: ROLE_OPTIONS,
      hint: "What this login may see and do. The API enforces it on every request.",
    },
    {
      // Update leaves the password alone when it is omitted, and a blank one
      // would be a change nobody asked for, so it is only ever set on create.
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      createOnly: true,
      autoComplete: "new-password",
      hint: "At least 8 characters.",
    },
    {
      name: "employeeId",
      label: "Employee record",
      type: "select",
      options: refs?.employees,
      clearable: true,
      hint: "Links the login to a person, so they can see their own records.",
    },
    { name: "active", label: "Can sign in", type: "switch" },
  ];
}
