"use server";

import { deleteRecord, saveRecord, type FormState } from "@/lib/mutate";
import {
  departmentFields,
  positionFields,
  scheduleFields,
  userFields,
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

const USER = { path: "/users", fields: userFields(), label: "User" };

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

export async function saveUser(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(USER, formData);
}

export async function deleteUser(id: string): Promise<FormState> {
  return deleteRecord(USER, id);
}
