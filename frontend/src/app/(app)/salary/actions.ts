"use server";

import { deleteRecord, saveRecord, type FormState } from "@/lib/mutate";
import { ruleFields, structureFields } from "./fields";

const STRUCTURE = {
  path: "/salary-structures",
  fields: structureFields(),
  label: "Structure",
};

const RULE = {
  path: "/salary-rules",
  fields: ruleFields(),
  label: "Rule",
};

/** Creates when the form carries no id, updates when it does. */
export async function saveStructure(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(STRUCTURE, formData);
}

/**
 * A structure still used by a payslip is deactivated rather than removed, so
 * the history keeps the structure it was computed against. The API decides
 * which happens; both come back as a success.
 */
export async function deleteStructure(id: string): Promise<FormState> {
  return deleteRecord(STRUCTURE, id);
}

export async function saveRule(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(RULE, formData);
}

/** Deactivated instead of deleted once payslip lines reference it. */
export async function deleteRule(id: string): Promise<FormState> {
  return deleteRecord(RULE, id);
}
