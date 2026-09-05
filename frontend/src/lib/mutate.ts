import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import { ApiError, apiFetch } from "@/lib/api-client";
import { readForm, type FieldSpec, type FieldValues } from "@/lib/fields";
import { REF_TAGS } from "@/lib/refs";
import { FORM_IDLE, type FormState } from "@/lib/form-state";

export { FORM_IDLE, type FormState };


export type ResourceConfig = {
  /** API collection path, e.g. "/employees". */
  path: string;
  fields: FieldSpec[];
  /** Singular, sentence case: "Employee", "Time off request". */
  label: string;
};

/**
 * Which reference list a write invalidates, keyed by the API collection it was
 * written to. Anything not listed here has no cached list of its own.
 */
const PATH_REF_TAGS: { prefix: string; tag: string }[] = [
  { prefix: "/employees", tag: REF_TAGS.employees },
  { prefix: "/departments", tag: REF_TAGS.departments },
  { prefix: "/job-positions", tag: REF_TAGS.positions },
  { prefix: "/working-schedules", tag: REF_TAGS.schedules },
  { prefix: "/salary-structures", tag: REF_TAGS.structures },
  { prefix: "/time-off/types", tag: REF_TAGS.timeOffTypes },
];

/**
 * Server actions bypass the client router cache, so a write has to say what to
 * re-render.
 *
 * Page data is per-request and uncached, so the route tree still has to be
 * revalidated wholesale. The reference lists are the part that *is* cached, and
 * they are dropped by tag so a write to one collection does not discard the
 * other five.
 */
function revalidateAll(path?: string) {
  revalidatePath("/", "layout");

  if (!path) return;
  for (const { prefix, tag } of PATH_REF_TAGS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      // Next 16 requires a cache profile; "minutes" matches the ref list TTL.
      revalidateTag(tag, "minutes");
    }
  }
}

/**
 * class-validator returns messages that lead with the property name, so
 * "wage must not be less than 0" becomes an error on the wage field, reworded
 * with the label the form actually shows.
 */
function toFieldErrors(
  details: string[] | undefined,
  fields: FieldSpec[],
): Record<string, string> | undefined {
  if (!details?.length) return undefined;

  const byName = new Map(fields.map((field) => [field.name, field.label]));
  const errors: Record<string, string> = {};

  for (const detail of details) {
    const name = detail.split(" ")[0];
    const label = byName.get(name);
    if (!label || errors[name]) continue;
    const rest = detail.slice(name.length).trim();
    errors[name] = rest ? `${label} ${rest}` : detail;
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
}

/** Turns any thrown error into something the form can render. */
function toFormState<T>(error: unknown, fields: FieldSpec[]): FormState<T> {
  if (error instanceof ApiError) {
    const fieldErrors = toFieldErrors(error.details, fields);
    // With every message attributed to a field, the banner would just repeat
    // the first one.
    return fieldErrors ? { fieldErrors } : { error: error.message };
  }
  throw error;
}

/**
 * Create or update, decided by the hidden `id` the edit form carries. One
 * action per resource covers both, which is why a resource needs roughly ten
 * lines of its own.
 */
export async function saveRecord<T = unknown>(
  config: ResourceConfig,
  formData: FormData,
  /** Values the form does not collect, such as an id from the page context. */
  extra?: FieldValues,
): Promise<FormState<T>> {
  const id = String(formData.get("id") ?? "").trim();
  const { values, fieldErrors } = readForm(formData, config.fields);
  if (fieldErrors) return { fieldErrors };

  try {
    const record = await apiFetch<(T & { id?: string }) | undefined>(
      id ? `${config.path}/${id}` : config.path,
      { method: id ? "PATCH" : "POST", body: { ...values, ...extra } },
    );
    revalidateAll(config.path);
    return {
      ok: true,
      id: record?.id ?? id,
      record,
      message: `${config.label} ${id ? "updated" : "created"}.`,
    };
  } catch (error) {
    return toFormState<T>(error, config.fields);
  }
}

/**
 * Several endpoints archive rather than delete once payroll history refers to
 * the record, and they say which one happened in the response. Reporting
 * "deleted" either way would tell the user something untrue while the row is
 * still on screen, so the confirmation is worded from what came back.
 */
export async function deleteRecord(
  config: Pick<ResourceConfig, "path" | "label">,
  id: string,
  /** Wording for the archive path, when "kept" understates it. */
  archivedMessage?: string,
): Promise<FormState> {
  try {
    const result = await apiFetch<
      { deleted?: boolean; archived?: boolean } | undefined
    >(`${config.path}/${id}`, { method: "DELETE" });
    revalidateAll(config.path);

    const archived = result?.archived === true || result?.deleted === false;
    return {
      ok: true,
      message: archived
        ? (archivedMessage ??
          `${config.label} is still referenced elsewhere, so it was archived rather than deleted.`)
        : `${config.label} deleted.`,
    };
  } catch (error) {
    return toFormState(error, []);
  }
}

/**
 * A verb the API owns rather than a record edit: approve, refuse, compute,
 * mark paid. Same return shape, so the button that calls it behaves like
 * every other one.
 */
export async function callAction<T = unknown>(options: {
  path: string;
  method?: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * Shown on success. Pass a function where the API reports what it actually
   * did — how many emails went out, say — so the confirmation carries it.
   */
  message: string | ((result: T) => string);
}): Promise<FormState<T>> {
  try {
    const result = await apiFetch<T>(options.path, {
      method: options.method ?? "POST",
      body: options.body,
    });
    revalidateAll(options.path);
    return {
      ok: true,
      record: result,
      message:
        typeof options.message === "function"
          ? options.message(result)
          : options.message,
    };
  } catch (error) {
    return toFormState<T>(error, []);
  }
}
