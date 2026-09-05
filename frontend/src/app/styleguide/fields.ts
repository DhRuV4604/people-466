import type { FieldSpec } from "@/lib/fields";

/**
 * A stand-in record for the styleguide, so the write components can be shown
 * working rather than described. It has one field of each kind the form
 * renderer handles.
 */
export const DEMO_FIELDS: FieldSpec[] = [
  { name: "name", label: "Full name", required: true, placeholder: "Priya Patel" },
  {
    name: "email",
    label: "Work email",
    type: "email",
    required: true,
    placeholder: "name@company.com",
  },
  {
    name: "role",
    label: "Role",
    type: "select",
    options: [
      { value: "owner", label: "Owner" },
      { value: "admin", label: "Admin" },
      { value: "member", label: "Member" },
    ],
  },
  { name: "startDate", label: "Start date", type: "date" },
  {
    name: "salary",
    label: "Annual salary",
    type: "number",
    min: 0,
    hint: "Checked before the request leaves the browser.",
  },
  { name: "active", label: "Active", type: "switch" },
  {
    name: "notes",
    label: "Notes",
    type: "textarea",
    clearable: true,
    placeholder: "Anything the team should know",
  },
];
