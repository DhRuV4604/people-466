"use server";

import { redirect } from "next/navigation";

import type { EmployeeDetailDto } from "@peoplepay360/shared";

import {
  callAction,
  deleteRecord,
  saveRecord,
  type FormState,
} from "@/lib/mutate";
import { employeeFields } from "./fields";

const EMPLOYEE = {
  path: "/employees",
  fields: employeeFields(),
  label: "Employee",
};

/**
 * Creates when the form carries no id, updates when it does.
 *
 * A create also issues a sign-in. Where the invite could not be delivered the
 * API hands back the one-time password, and it is put in front of whoever
 * created the employee: it exists nowhere else, so saying nothing would leave
 * them with an account no one can get into.
 */
export async function saveEmployee(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const state = await saveRecord<EmployeeDetailDto>(EMPLOYEE, formData);
  const invite = state.record?.invite;

  if (!state.ok || !invite || invite.delivered) return state;

  return {
    ...state,
    message: undefined,
    warning: {
      title: "Employee created, but the invite was not sent.",
      body:
        invite.error ??
        "No mail transport is configured, so nothing was delivered.",
      secret: invite.oneTimePassword,
      secretLabel: "One-time password — give it to them yourself",
    },
  };
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

/**
 * Issues a new one-time password and mails it.
 *
 * The confirmation says whether it actually left: the API records a failed
 * invite rather than throwing, so a silent "sent" would be a lie on any
 * install without mail configured.
 */
export async function reinviteEmployee(id: string): Promise<FormState> {
  const state = await callAction<{
    delivered: boolean;
    error?: string;
    oneTimePassword?: string;
  }>({
    path: `/employees/${id}/reinvite`,
    message: "Invite sent. The new password works once.",
  });

  const result = state.record;
  if (!state.ok || !result || result.delivered) return state;

  return {
    ...state,
    message: undefined,
    warning: {
      title: "A new password was set, but the invite was not sent.",
      body:
        result.error ??
        "No mail transport is configured, so nothing was delivered.",
      secret: result.oneTimePassword,
      secretLabel: "One-time password — give it to them yourself",
    },
  };
}
