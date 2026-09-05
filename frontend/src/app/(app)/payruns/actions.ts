"use server";

import { redirect } from "next/navigation";
import type { SendPayslipsResultDto } from "@peoplepay360/shared";

import { readForm } from "@/lib/fields";
import { pluralise } from "@/lib/format";
import {
  callAction,
  deleteRecord,
  saveRecord,
  type FormState,
} from "@/lib/mutate";
import { payrunRosterFields, payrunScopeFields } from "./fields";

/** What step one settles, carried to step two in the URL. */
export type PayrunScope = {
  name: string;
  structureId: string;
  periodStart: string;
  periodEnd: string;
  departmentId?: string;
  employeeType?: string;
};

const PAYRUN = {
  path: "/payruns",
  // Step two submits the roster and nothing else: the scope rides along as a
  // bound argument, so it cannot be edited out from under the eligibility the
  // API just worked out.
  fields: payrunRosterFields(),
  label: "Pay run",
};

/**
 * Step one writes nothing. It hands its answers to step two through the URL,
 * which keeps a roster shareable and lets the back button step back through
 * the wizard.
 */
export async function choosePayrunScope(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { values, fieldErrors } = readForm(formData, payrunScopeFields());
  if (fieldErrors) return { fieldErrors };

  // An inverted period is only rejected by the API a step later, at create,
  // and step two would meanwhile report everybody as having no contract.
  if (String(values.periodEnd) < String(values.periodStart)) {
    return {
      fieldErrors: {
        periodEnd: "Period end cannot be before the period start.",
      },
    };
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, String(value));
  }

  redirect(`/payruns/new?${query.toString()}`);
}

/** Step two. A new run is only useful from its own page, so it ends there. */
export async function createPayrun(
  scope: PayrunScope,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const state = await saveRecord(PAYRUN, formData, scope);
  if (!state.ok || !state.id) return state;

  redirect(`/payruns/${state.id}`);
}

export async function computePayrun(id: string): Promise<FormState> {
  return callAction({
    path: `/payruns/${id}/compute`,
    message: "Pay run computed.",
  });
}

export async function validatePayrun(id: string): Promise<FormState> {
  return callAction({
    path: `/payruns/${id}/validate`,
    message: "Pay run validated.",
  });
}

export async function markPayrunPaid(id: string): Promise<FormState> {
  return callAction({
    path: `/payruns/${id}/mark-paid`,
    message: "Pay run marked as paid.",
  });
}

export async function sendPayslips(id: string): Promise<FormState> {
  return callAction<SendPayslipsResultDto>({
    path: `/payruns/${id}/send-payslips`,
    // The API sends one payslip at a time and carries on past a failure, so
    // "sent" on its own would report a partial delivery as a success.
    message: ({ sent, failed }) =>
      failed === 0
        ? `${pluralise(sent, "payslip")} sent.`
        : `${pluralise(sent, "payslip")} sent, ${failed} failed. Payslip delivery on this run says why.`,
  });
}

/** Deleting from the record page destroys the page you are standing on. */
export async function deletePayrunAndReturn(id: string): Promise<FormState> {
  const state = await deleteRecord(PAYRUN, id);
  if (!state.ok) return state;

  redirect("/payruns");
}
