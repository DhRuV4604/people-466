"use server";

import { redirect } from "next/navigation";

import { deleteRecord, saveRecord, type FormState } from "@/lib/mutate";
import { employeeFields } from "./fields";

const EMPLOYEE = {
  path: "/employees",
  fields: employeeFields(),
  label: "Employee",
};

/** Creates when the form carries no id, updates when it does. */
export async function saveEmployee(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(EMPLOYEE, formData);
}

export async function deleteEmployee(id: string): Promise<FormState> {
  return deleteRecord(EMPLOYEE, id);
}

/**
 * Deleting from the record page destroys the page you are standing on, so it
 * ends on the list. A client component cannot redirect after awaiting an
 * action, which is why the navigation lives here.
 */
export async function deleteEmployeeAndReturn(id: string): Promise<FormState> {
  const state = await deleteRecord(EMPLOYEE, id);
  if (!state.ok) return state;
  redirect("/employees");
}
