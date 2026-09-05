"use server";

import { readForm } from "@/lib/fields";
import type { FormState } from "@/lib/mutate";

import { DEMO_FIELDS } from "./fields";

/**
 * The styleguide's examples are live, not screenshots, so they need a real
 * server action to submit to. These two run the same validation the app does
 * and then store nothing, which is the whole difference.
 */
export async function demoSave(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { fieldErrors } = readForm(formData, DEMO_FIELDS);
  if (fieldErrors) return { fieldErrors };
  return { ok: true, message: "Saved. Nothing was stored: this is the styleguide." };
}

export async function demoApprove(): Promise<FormState> {
  return { ok: true, message: "Approved. Nothing was stored: this is the styleguide." };
}

export async function demoDelete(): Promise<FormState> {
  return { ok: true, message: "Deleted. Nothing was stored: this is the styleguide." };
}
