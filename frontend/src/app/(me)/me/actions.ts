"use server";

import { callAction, saveRecord, type FormState } from "@/lib/mutate";
import { getSession } from "@/lib/session";
import { leaveFields } from "./fields";

/**
 * Both punches act on the signed-in user's own record and take no body. The
 * API decides whether they are allowed — a second check-in, or a check-out
 * with nothing open, comes back as its error and is shown as-is.
 */
export async function punchIn(): Promise<FormState> {
  return callAction({ path: "/attendance/check-in", message: "Checked in. Have a good one." });
}

export async function punchOut(): Promise<FormState> {
  return callAction({ path: "/attendance/check-out", message: "Checked out. See you tomorrow." });
}

const LEAVE = {
  path: "/time-off/requests",
  // Options are irrelevant when reading the submission back.
  fields: leaveFields([]),
  label: "Leave request",
};

/**
 * Files leave for the signed-in employee. The employee id comes from the
 * session, never the form: an Employee is scoped to their own record by the API
 * regardless, but an HR user with a record of their own using this space needs
 * it supplied, and either way the browser is not the place to decide whose
 * request it is.
 */
export async function requestLeave(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session?.employeeId) {
    return { error: "No employee record is linked to this account." };
  }
  return saveRecord(LEAVE, formData, { employeeId: session.employeeId });
}

/** Withdraws a request that has not been decided, or one already approved. */
export async function withdrawLeave(id: string): Promise<FormState> {
  return callAction({
    path: `/time-off/requests/${id}/cancel`,
    message: "Request withdrawn.",
  });
}
