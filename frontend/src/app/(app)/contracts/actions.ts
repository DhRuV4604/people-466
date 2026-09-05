"use server";

import { deleteRecord, saveRecord, type FormState } from "@/lib/mutate";
import { contractFields } from "./fields";

const CONTRACT = {
  path: "/contracts",
  fields: contractFields(),
  label: "Contract",
};

/** Creates when the form carries no id, updates when it does. */
export async function saveContract(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(CONTRACT, formData);
}

export async function deleteContract(id: string): Promise<FormState> {
  return deleteRecord(CONTRACT, id);
}
