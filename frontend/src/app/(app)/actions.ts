"use server";

import { redirect } from "next/navigation";

import { logout } from "@/lib/session";
import { callAction, type FormState } from "@/lib/mutate";

/** Clears the session cookies and returns to the login screen. */
export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}

/**
 * The verbs behind the dashboard task strip.
 *
 * They forward to the same endpoints the owning screens use rather than
 * reaching into the API differently, so a task finished here is the same write
 * as one finished on the time-off or employees screen — including the
 * notification it sends and the audit entry it leaves.
 */
export async function approveLeaveTask(id: string): Promise<FormState> {
  return callAction({
    path: `/time-off/requests/${id}/approve`,
    message: "Approved.",
  });
}

export async function refuseLeaveTask(
  id: string,
  reason: string,
): Promise<FormState> {
  return callAction({
    path: `/time-off/requests/${id}/refuse`,
    body: { reason },
    message: "Refused. They have been told why.",
  });
}

export async function sendInviteTask(employeeId: string): Promise<FormState> {
  return callAction({
    path: `/employees/${employeeId}/reinvite`,
    message: "Invite sent.",
  });
}

/**
 * Fills in the two fields that stop payroll paying someone.
 *
 * A PATCH of exactly those fields rather than the whole employee: the task
 * knows nothing about the rest of the record, and sending a partial one back
 * would blank whatever it had not been given.
 */
export async function saveBankDetailsTask(
  employeeId: string,
  bankName: string,
  bankAccountNumber: string,
): Promise<FormState> {
  return callAction({
    path: `/employees/${employeeId}`,
    method: "PATCH",
    body: { bankName: bankName.trim(), bankAccountNumber: bankAccountNumber.trim() },
    message: "Bank details saved.",
  });
}
