/**
 * One field spec drives both sides of a form: the client renders it, and the
 * server action reads the submitted values back out of it. Declaring a
 * resource's fields once is the whole point, so adding a column is a single
 * line rather than an edit in three files.
 *
 * This module is deliberately free of server and client imports so both can
 * use it.
 */

export type FieldOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "password"
  | "number"
  | "date"
  | "datetime"
  | "textarea"
  | "select"
  | "multiselect"
  | "switch"
  | "color"
  /**
   * A value the generic form cannot collect, supplied by a control passed in
   * through the form's `extras` slot as a hidden input holding JSON. The form
   * renders no control of its own for it.
   */
  | "json";

export type FieldSpec = {
  name: string;
  label: string;
  /** Defaults to "text". */
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  /** A line under the control, for anything the label cannot carry. */
  hint?: string;
  options?: FieldOption[];
  /**
   * Submitting this field empty sends null, which clears it. Without this an
   * empty optional field is omitted, so a PATCH leaves the stored value alone.
   * Never set it on an enum column: the API rejects a null there.
   */
  clearable?: boolean;
  /** Full width inside the two column grid. Textareas are always full. */
  span?: "half" | "full";
  min?: number;
  max?: number;
  step?: number;
  /** Character limit on a text control, matching the API's own. */
  maxLength?: number;
  /**
   * Seeds the control when creating. An edit ignores it, because the record
   * being edited is the authority on its own values. Set it wherever the API
   * has a default of its own, so a create posts what the API would.
   */
  defaultValue?: string | number | boolean;
  autoComplete?: string;
  /** Hidden on the edit form, e.g. a password that is only set on create. */
  createOnly?: boolean;
};

export type FieldValues = Record<string, unknown>;

/**
 * The reference lists a form uses to point one record at another. Field specs
 * take these as an argument, so the same spec serves the page (with options
 * loaded) and the server action (which only needs the names and types).
 */
export type RefName =
  | "departments"
  | "positions"
  | "schedules"
  | "employees"
  | "structures"
  | "timeOffTypes";

export type Refs = Record<RefName, FieldOption[]>;

/**
 * A select has no empty state of its own, so a clearable one gets this as its
 * first option and the form posts it as an empty value.
 */
export const NO_SELECTION = "__none__";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "First name" reads better than "firstName" in a message. */
export function labelOf(fields: FieldSpec[], name: string): string {
  return fields.find((field) => field.name === name)?.label ?? name;
}

/**
 * Turns submitted form data into the JSON body the API expects, applying the
 * cheap checks (required, number, email) that are worth catching before a
 * round trip. Everything else is left to the API, which is the authority.
 */
export function readForm(
  formData: FormData,
  fields: FieldSpec[],
): { values: FieldValues; fieldErrors?: Record<string, string> } {
  const values: FieldValues = {};
  const fieldErrors: Record<string, string> = {};

  for (const field of fields) {
    const type = field.type ?? "text";

    // An unchecked switch submits nothing at all, so absence is false.
    if (type === "switch") {
      const raw = formData.get(field.name);
      values[field.name] = raw === "on" || raw === "true";
      continue;
    }

    if (type === "multiselect") {
      const chosen = formData
        .getAll(field.name)
        .map(String)
        .filter(Boolean);
      if (chosen.length === 0) {
        if (field.required) fieldErrors[field.name] = `Choose at least one ${field.label.toLowerCase()}.`;
      } else {
        values[field.name] = chosen;
      }
      continue;
    }

    // A field the form did not render is not part of this submission.
    if (!formData.has(field.name)) continue;

    const raw = formData.get(field.name);
    const text = typeof raw === "string" ? raw.trim() : "";

    if (!text) {
      if (field.required) fieldErrors[field.name] = `${field.label} is required.`;
      else if (field.clearable) values[field.name] = null;
      continue;
    }

    if (type === "json") {
      try {
        values[field.name] = JSON.parse(text);
      } catch {
        fieldErrors[field.name] = `${field.label} could not be read.`;
      }
      continue;
    }

    if (type === "number") {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) {
        fieldErrors[field.name] = `${field.label} must be a number.`;
      } else if (field.min !== undefined && parsed < field.min) {
        fieldErrors[field.name] = `${field.label} cannot be below ${field.min}.`;
      } else if (field.max !== undefined && parsed > field.max) {
        fieldErrors[field.name] = `${field.label} cannot be above ${field.max}.`;
      } else {
        values[field.name] = parsed;
      }
      continue;
    }

    if (type === "email" && !EMAIL.test(text)) {
      fieldErrors[field.name] = "That doesn't look like a valid email address.";
      continue;
    }

    // A datetime-local control submits wall time with no zone. The form shows
    // that wall time in UTC, matching every other surface in the app, so it is
    // read back the same way.
    if (type === "datetime") {
      const at = new Date(`${text.length === 16 ? `${text}:00` : text}Z`);
      if (Number.isNaN(at.getTime())) {
        fieldErrors[field.name] = `${field.label} is not a valid date and time.`;
      } else {
        values[field.name] = at.toISOString();
      }
      continue;
    }

    values[field.name] = text;
  }

  return {
    values,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}

/**
 * The same field list with one field dropped.
 *
 * A page that already fixes a value — the employee on their own record page —
 * binds it into the server action and takes the control off the form, so no
 * form offers a choice the page has already made.
 */
export function withoutField(fields: FieldSpec[], name: string): FieldSpec[] {
  return fields.filter((field) => field.name !== name);
}
