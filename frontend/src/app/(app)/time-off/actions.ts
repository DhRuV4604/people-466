"use server";

import { readForm } from "@/lib/fields";
import {
  callAction,
  deleteRecord,
  saveRecord,
  type FormState,
} from "@/lib/mutate";

import {
  allocationFields,
  refusalFields,
  requestFields,
  timeOffTypeFields,
} from "./fields";

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

const TYPE = {
  path: "/time-off/types",
  fields: timeOffTypeFields(),
  label: "Time off type",
};

// ---------------------------------------------------------------- Requests

/** Creates when the form carries no id, updates when it does. */
export async function saveRequest(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(REQUEST, formData);
}

export async function deleteRequest(id: string): Promise<FormState> {
  return deleteRecord(REQUEST, id);
}

export async function approveRequest(id: string): Promise<FormState> {
  return callAction({
    path: `/time-off/requests/${id}/approve`,
    message: "Request approved.",
  });
}

export async function refuseRequest(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // One optional line, so nothing here can fail before the round trip.
  const { values } = readForm(formData, refusalFields());
  return callAction({
    path: `/time-off/requests/${id}/refuse`,
    body: values,
    message: "Request refused.",
  });
}

export async function cancelRequest(id: string): Promise<FormState> {
  return callAction({
    path: `/time-off/requests/${id}/cancel`,
    message: "Request cancelled.",
  });
}

// ---------------------------------------------------------------- Allocations

export async function saveAllocation(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(ALLOCATION, formData);
}

export async function deleteAllocation(id: string): Promise<FormState> {
  return deleteRecord(ALLOCATION, id);
}

export async function approveAllocation(id: string): Promise<FormState> {
  return callAction({
    path: `/time-off/allocations/${id}/approve`,
    message: "Allocation approved.",
  });
}

export async function refuseAllocation(id: string): Promise<FormState> {
  return callAction({
    path: `/time-off/allocations/${id}/refuse`,
    message: "Allocation refused.",
  });
}

// ---------------------------------------------------------------- Types

export async function saveTimeOffType(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveRecord(TYPE, formData);
}

/**
 * A type with requests behind it is archived rather than removed, so the
 * confirmation has to say which of the two happened. The caller knows from the
 * row's request count, which is the same condition the API applies.
 */
export async function deleteTimeOffType(
  id: string,
  archives: boolean,
): Promise<FormState> {
  return callAction({
    path: `/time-off/types/${id}`,
    method: "DELETE",
    message: archives ? "Time off type archived." : "Time off type deleted.",
  });
}
