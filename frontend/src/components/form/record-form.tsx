"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import {
  Button,
  DatePicker,
  Field,
  FieldError,
  FieldLabel,
  Input,
  InputGroup,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { NO_SELECTION, type FieldSpec } from "@/lib/fields";
import type { FormState } from "@/lib/mutate";
import { cn } from "@/lib/utils";

const IDLE: FormState = {};

export type RecordFormProps = {
  fields: FieldSpec[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /**
   * The record being edited. Its id switches the action from create to update.
   * Typed loosely on purpose: a shared DTO is an interface, and an interface
   * has no implicit index signature, so requiring one would force every caller
   * to spread the row.
   */
  defaults?: object;
  submitLabel?: string;
  /** Called once the action succeeds, so a dialog can close and confirm. */
  onDone?: (state: FormState) => void;
  onCancel?: () => void;
  cancelLabel?: string;
  /**
   * Controls the field list cannot express, rendered under the grid. Pair one
   * with a `json` field, which the control fills through a hidden input.
   */
  extras?: React.ReactNode;
  className?: string;
};

/**
 * Renders a resource's fields, submits them to its server action, and puts the
 * messages that come back next to the inputs they belong to. Every form in the
 * app is this component with a different field list, so spacing, error
 * placement and the busy state are identical everywhere.
 */
export function RecordForm({
  fields,
  action,
  defaults,
  submitLabel,
  onDone,
  onCancel,
  cancelLabel = "Cancel",
  extras,
  className,
}: RecordFormProps) {
  const [state, formAction, pending] = React.useActionState(action, IDLE);
  const values = defaults as Record<string, unknown> | undefined;
  const recordId = values?.id ? String(values.id) : "";
  const isEdit = recordId !== "";

  const handled = React.useRef<FormState | null>(null);
  React.useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      onDone?.(state);
    }
  }, [state, onDone]);

  const visible = fields.filter(
    (field) => field.type !== "json" && !(isEdit && field.createOnly),
  );

  return (
    <form action={formAction} noValidate className={className}>
      {isEdit ? <input type="hidden" name="id" value={recordId} /> : null}

      <div className="flex flex-col gap-5">
        {state.error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
          {visible.map((field) => (
            <FormField
              key={field.name}
              field={field}
              defaultValue={
                values && field.name in values
                  ? values[field.name]
                  : field.defaultValue
              }
              error={state.fieldErrors?.[field.name]}
              disabled={pending}
            />
          ))}
        </div>

        {extras}

        {/* A json field is filled by a control in `extras`, so its message has
            nowhere else to appear. */}
        {fields
          .filter((field) => field.type === "json" && state.fieldErrors?.[field.name])
          .map((field) => (
            <FieldError key={field.name} message={state.fieldErrors?.[field.name]} />
          ))}
      </div>

      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="submit" loading={pending} loadingText="Saving">
          {submitLabel ?? (isEdit ? "Save changes" : "Create")}
        </Button>
      </div>
    </form>
  );
}

/** One labelled row. The control varies; the wrapper never does. */
function FormField({
  field,
  defaultValue,
  error,
  disabled,
}: {
  field: FieldSpec;
  defaultValue: unknown;
  error?: string;
  disabled: boolean;
}) {
  const type = field.type ?? "text";
  const full = field.span === "full" || type === "textarea";
  const id = `field-${field.name}`;
  // Times are shown and stored in UTC throughout, so say so rather than let
  // someone read a punch as their own wall clock.
  const hint =
    type === "datetime"
      ? field.hint
        ? `${field.hint} Times are UTC.`
        : "Times are UTC."
      : field.hint;

  return (
    <Field className={cn(full && "sm:col-span-2")}>
      <FieldLabel htmlFor={id}>
        {field.label}
        {field.required ? (
          <span className="ml-0.5 text-muted-foreground">*</span>
        ) : null}
      </FieldLabel>

      <FormControl
        id={id}
        field={field}
        defaultValue={defaultValue}
        invalid={!!error}
        disabled={disabled}
      />

      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      <FieldError message={error} />
    </Field>
  );
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** The label a select would have shown for this value, when it has one. */
function optionLabel(field: FieldSpec, value: string): string | undefined {
  return field.options?.find((option) => option.value === value)?.label;
}

/**
 * The calendar day, as "2024-06-01".
 *
 * The two sources need opposite treatment: the picker hands back a Date at
 * LOCAL midnight, which read in UTC would move a day west of the date the user
 * clicked, while the API sends an ISO string whose first ten characters are
 * already the calendar date and need no conversion at all. Reading either one
 * the other's way shifts the date by a day.
 */
function toDateValue(value: unknown): string {
  if (!value) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }

  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

/**
 * An instant, as the wall time a datetime-local shows.
 *
 * Read in UTC rather than the browser's zone, because every other surface in
 * the app prints instants in UTC (`formatTime` pins it, so the server and the
 * client cannot disagree). Showing local time only here would mean the same
 * punch read 09:02 in the table and 14:32 in the dialog that edits it.
 */
function toDateTimeValue(value: unknown): string {
  if (!value) return "";
  const at = new Date(String(value));
  if (Number.isNaN(at.getTime())) return "";
  return at.toISOString().slice(0, 16);
}

function FormControl({
  id,
  field,
  defaultValue,
  invalid,
  disabled,
}: {
  id: string;
  field: FieldSpec;
  defaultValue: unknown;
  invalid: boolean;
  disabled: boolean;
}) {
  const type = field.type ?? "text";

  // The select, switch and date controls are not native inputs, so each keeps
  // its value in state and posts it through a hidden input. Declared before
  // any branch below, because a hook cannot sit behind a condition.
  const [value, setValue] = React.useState(() => {
    if (type === "date") return toDateValue(defaultValue);
    if (type === "switch") return defaultValue ? "on" : "";
    return text(defaultValue);
  });

  // A locked field is not a control: it posts its value and says what it is.
  if (field.locked) {
    const posted = text(field.defaultValue ?? defaultValue);
    return (
      <>
        <input type="hidden" name={field.name} value={posted} />
        <div
          id={id}
          className="flex min-h-12 items-center rounded-xl border border-input bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground"
        >
          {field.lockedLabel ?? optionLabel(field, posted) ?? posted ?? "—"}
        </div>
      </>
    );
  }

  if (type === "select") {
    // A select cannot be emptied by clicking away from it, so a field that is
    // allowed to be blank gets an explicit way back to blank.
    const options = field.clearable
      ? [{ value: NO_SELECTION, label: "None" }, ...(field.options ?? [])]
      : (field.options ?? []);

    return (
      <>
        <input
          type="hidden"
          name={field.name}
          value={value === NO_SELECTION ? "" : value}
        />
        <Select
          id={id}
          options={options}
          value={value}
          onValueChange={setValue}
          placeholder={field.placeholder ?? "Select an option"}
          invalid={invalid}
          disabled={disabled}
        />
      </>
    );
  }

  if (type === "multiselect") {
    const chosen = new Set(
      Array.isArray(defaultValue) ? defaultValue.map(String) : [],
    );
    return (
      <div
        className="max-h-56 overflow-y-auto rounded-xl border border-input p-1"
        aria-invalid={invalid}
      >
        {(field.options ?? []).map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors select-none hover:bg-muted/60"
          >
            <input
              type="checkbox"
              name={field.name}
              value={option.value}
              defaultChecked={chosen.has(option.value)}
              disabled={disabled || option.disabled}
              className="size-4 shrink-0 accent-primary"
            />
            <span className="min-w-0">{option.label}</span>
          </label>
        ))}
        {(field.options ?? []).length === 0 ? (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">
            Nothing to choose from yet.
          </p>
        ) : null}
      </div>
    );
  }

  if (type === "switch") {
    return (
      <div className="flex h-12 items-center">
        {value ? <input type="hidden" name={field.name} value="on" /> : null}
        <Switch
          id={id}
          checked={value === "on"}
          onCheckedChange={(next) => setValue(next ? "on" : "")}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "date") {
    return (
      <>
        <input type="hidden" name={field.name} value={value} />
        <DatePicker
          id={id}
          value={value ? new Date(`${value}T00:00:00`) : undefined}
          onChange={(date) => setValue(date ? toDateValue(date) : "")}
          placeholder={field.placeholder ?? "Pick a date"}
          invalid={invalid}
          disabled={disabled}
        />
      </>
    );
  }

  if (type === "textarea") {
    return (
      <Textarea
        id={id}
        name={field.name}
        defaultValue={text(defaultValue)}
        placeholder={field.placeholder}
        aria-invalid={invalid}
        disabled={disabled}
        rows={3}
      />
    );
  }

  return (
    <InputGroup invalid={invalid}>
      <Input
        id={id}
        name={field.name}
        type={type === "datetime" ? "datetime-local" : type}
        defaultValue={
          type === "datetime"
            ? toDateTimeValue(defaultValue)
            : text(defaultValue)
        }
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        min={field.min}
        max={field.max}
        step={field.step}
        maxLength={field.maxLength}
        aria-invalid={invalid}
        disabled={disabled}
      />
    </InputGroup>
  );
}
