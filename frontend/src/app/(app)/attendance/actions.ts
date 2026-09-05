"use server";

import { callAction, deleteRecord, saveRecord, type FormState } from "@/lib/mutate";
import { attendanceEditFields, attendanceFields } from "./fields";

const ATTENDANCE = {
  path: "/attendance",
  fields: attendanceFields(),
  label: "Attendance record",
};

/** A correction submits the status override and the reason as well. */
const CORRECTION = { ...ATTENDANCE, fields: attendanceEditFields() };

export async function saveAttendance(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(ATTENDANCE, formData);
}

/** The correction form always carries the record's id, so this is a PATCH. */
export async function correctAttendance(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(CORRECTION, formData);
}

export async function deleteAttendance(id: string): Promise<FormState> {
  return deleteRecord(ATTENDANCE, id);
}

/**
 * Both punches act on the signed-in user's own employee record and take no
 * body, so the API is the only thing that decides whether they are allowed:
 * a second check-in, or a check-out with nothing open, comes back as an error.
 */
export async function checkIn(): Promise<FormState> {
  return callAction({ path: "/attendance/check-in", message: "Checked in." });
}

export async function checkOut(): Promise<FormState> {
  return callAction({ path: "/attendance/check-out", message: "Checked out." });
}
