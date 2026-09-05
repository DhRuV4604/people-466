import type { FieldOption, FieldSpec } from "@/lib/fields";

/**
 * A leave request as an employee files it. There is no employee field: the
 * request is always for whoever is signed in, and the server action supplies
 * that id itself rather than trusting one from the form.
 */
export function leaveFields(types: FieldOption[]): FieldSpec[] {
  return [
    {
      name: "typeId",
      label: "Type of leave",
      type: "select",
      required: true,
      options: types,
      span: "full",
    },
    { name: "dateFrom", label: "First day", type: "date", required: true },
    { name: "dateTo", label: "Last day", type: "date", required: true },
    {
      name: "reason",
      label: "Reason",
      type: "textarea",
      clearable: true,
      placeholder: "Optional — a line for whoever approves it.",
      hint: "Weekends and rest days are not counted against you.",
    },
  ];
}
