"use server";

import { revalidatePath } from "next/cache";

import { ApiError, apiFetch } from "@/lib/api-client";
import { readForm } from "@/lib/fields";
import { deleteRecord, saveRecord, type FormState } from "@/lib/mutate";
import {
  attendancePolicyFields,
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
