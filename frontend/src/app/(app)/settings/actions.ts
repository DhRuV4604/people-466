"use server";

import { revalidatePath } from "next/cache";

import { ApiError, apiFetch, apiUpload } from "@/lib/api-client";
import { readForm } from "@/lib/fields";
import { deleteRecord, saveRecord, type FormState } from "@/lib/mutate";
import {
  attendancePolicyFields,
  companyFields,
  departmentFields,
  positionFields,
  scheduleFields,
} from "./fields";

const DEPARTMENT = {
  path: "/departments",
  fields: departmentFields(),
  label: "Department",
};

const POSITION = {
  path: "/job-positions",
  fields: positionFields(),
  label: "Job position",
};

const SCHEDULE = {
  path: "/working-schedules",
  fields: scheduleFields(),
  label: "Working schedule",
};


/** Creates when the form carries no id, updates when it does. */
export async function saveDepartment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(DEPARTMENT, formData);
}

export async function deleteDepartment(id: string): Promise<FormState> {
  return deleteRecord(DEPARTMENT, id);
}

export async function savePosition(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(POSITION, formData);
}

export async function deletePosition(id: string): Promise<FormState> {
  return deleteRecord(POSITION, id);
}

export async function saveSchedule(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(SCHEDULE, formData);
}

export async function deleteSchedule(id: string): Promise<FormState> {
  return deleteRecord(SCHEDULE, id);
}


/**
 * The attendance policy is one pinned row rather than a collection, so it is
 * always a PATCH to a fixed path: `saveRecord` would need an id to decide, and
 * there is none to give it.
 */
export async function saveAttendancePolicy(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = attendancePolicyFields();
  const { values, fieldErrors } = readForm(formData, fields);
  if (fieldErrors) return { fieldErrors };

  try {
    await apiFetch("/app-settings", { method: "PATCH", body: values });
    // The punch card reads this on every render of the self-service space, so
    // the whole tree is re-rendered rather than just this screen.
    revalidatePath("/", "layout");
    return { ok: true, message: "Attendance policy updated." };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

/**
 * The company is one pinned row, like the attendance policy, so this is always
 * a PATCH to a fixed path rather than a create-or-update on an id.
 *
 * A blank box clears the field rather than being dropped. That is what a person
 * means when they empty an address line, and the API reads an empty string the
 * same way.
 */
export async function saveCompany(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = companyFields();
  const { values, fieldErrors } = readForm(formData, fields);
  if (fieldErrors) return { fieldErrors };

  const body = Object.fromEntries(
    fields.map((field) => [field.name, String(values[field.name] ?? "")] as const),
  );

  try {
    await apiFetch("/company", { method: "PATCH", body });
    // The name and logo sit in the shell and on every generated document, so
    // the whole tree re-renders rather than this screen alone.
    revalidatePath("/", "layout");
    return { ok: true, message: "Company details updated." };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

/** Replaces the logo. A new picture is a new file, so nothing is overwritten. */
export async function uploadLogo(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose an image." } };
  }

  const body = new FormData();
  body.set("file", file);

  try {
    await apiUpload("/company/logo", body);
    revalidatePath("/", "layout");
    return { ok: true, message: "Logo updated." };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function removeLogo(): Promise<FormState> {
  try {
    await apiFetch("/company/logo", { method: "DELETE" });
    revalidatePath("/", "layout");
    return { ok: true, message: "Logo removed." };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
