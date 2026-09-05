import { ATTENDANCE_STATUSES } from "@peoplepay360/shared";

import { employeeField, type FieldSpec, type Refs, type SelfEmployee } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

/**
 * A punch pair, as the create endpoint takes it. The page passes the loaded
 * reference lists; the server action calls it bare, because reading a
 * submission only needs the names and types.
 */
export function attendanceFields(
  refs?: Partial<Refs>,
  self?: SelfEmployee | null,
): FieldSpec[] {
  return [
    employeeField(
      {
        name: "employeeId",
        label: "Employee",
        // Optional on the DTO only because an employee recording their own
        // attendance has it taken from the session; every other caller is
        // rejected without it.
        required: true,
        span: "full",
      },
      refs,
      self,
    ),
    { name: "checkIn", label: "Check-in", type: "datetime", required: true },
    {
      name: "checkOut",
      label: "Check-out",
      type: "datetime",
      clearable: true,
      hint: "Leave blank while the shift is still open.",
    },
    { name: "notes", label: "Notes", type: "textarea", clearable: true },
  ];
}

/**
 * The correction form takes two fields the create form has no use for: the API
 * derives the status from the punches, so it can only be overridden on a
 * record that already exists, and the reason is what the audit trail keeps.
 * The employee is dropped because `update()` never writes a change to it, and
 * a control that silently does nothing is worse than no control. No field here
 * points at another record, so this list needs no reference lists.
 */
export function attendanceEditFields(): FieldSpec[] {
  const punches = attendanceFields().filter(
    (field) => field.name !== "employeeId" && field.name !== "notes",
  );

  return [
    ...punches,
    {
      name: "status",
      label: "Status",
      type: "select",
      options: statusOptions(ATTENDANCE_STATUSES),
      // The override always wins over the derived value, so a correction to
      // the times alone leaves the status as it stands.
      hint: "Saved as shown; changing the times does not re-derive it.",
    },
    {
      name: "editReason",
      label: "Reason",
      placeholder: "Biometric device failure",
    },
    {
      // `update()` reads `dto.notes ?? existing.notes`, so an empty box cannot
      // clear the stored note. Not clearable, because sending the null the
      // form would otherwise send changes nothing.
      name: "notes",
      label: "Notes",
      type: "textarea",
      hint: "Leaving this blank keeps the note already on the entry.",
    },
  ];
}
