"use server";

import { attendanceFields } from "@/app/(app)/attendance/fields";
import { contractFields } from "@/app/(app)/contracts/fields";
import { allocationFields, requestFields } from "@/app/(app)/time-off/fields";
import { saveRecord, type FormState } from "@/lib/mutate";

/**
 * Creating a record against one employee, from that employee's own page.
 *
 * On a module screen the form asks who the record is for. Here the route
 * already names them, so the id is bound into the action instead and the form
 * carries no employee control at all — a picker on a page about one person is
 * both noise and a way to file a correction against the wrong record.
 *
 * `saveRecord` merges the bound id over the submission, so it is the page's id
 * that reaches the API whatever the browser sent. Everything else is the
 * module's own: same paths, same field lists, so the API cannot tell these
 * writes from the ones made on the module screens.
 */

const ATTENDANCE = {
  path: "/attendance",
  fields: attendanceFields(),
  label: "Attendance record",
};

const CONTRACT = {
  path: "/contracts",
  fields: contractFields(),
  label: "Contract",
};

const REQUEST = {
  path: "/time-off/requests",
  fields: requestFields(),
  label: "Time off request",
};

const ALLOCATION = {
  path: "/time-off/allocations",
  fields: allocationFields(),
  label: "Allocation",
};

export async function saveAttendanceFor(
  employeeId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(ATTENDANCE, formData, { employeeId });
}

export async function saveContractFor(
  employeeId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(CONTRACT, formData, { employeeId });
}

export async function saveRequestFor(
  employeeId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(REQUEST, formData, { employeeId });
}

export async function saveAllocationFor(
  employeeId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(ALLOCATION, formData, { employeeId });
}
