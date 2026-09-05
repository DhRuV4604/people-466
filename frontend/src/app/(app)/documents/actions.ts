"use server";

import type { DocumentDto } from "@peoplepay360/shared";

import { ApiError, apiUpload } from "@/lib/api-client";
import { callAction, type FormState } from "@/lib/mutate";

/**
 * Uploads a document into someone's file.
 *
 * The form is passed through rather than read into values: the file is the
 * point, and rebuilding a multipart body from parsed fields would only be a
 * way to drop it. The API validates the text fields either way.
 */
export async function uploadDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState<DocumentDto>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a document to upload." } };
  }
  if (!String(formData.get("title") ?? "").trim()) {
    return { fieldErrors: { title: "Give it a name." } };
  }

  try {
    const record = await apiUpload<DocumentDto>("/documents", formData);
    return {
      ok: true,
      id: record.id,
      record,
      message:
        record.status === "AWAITING_SIGNATURE"
          ? "Sent. They will be asked to sign it."
          : "Added to their documents.",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
}

/** Asks an employee to supply a document. Nothing is attached yet. */
export async function requestDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState<DocumentDto>> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { fieldErrors: { title: "Say what you need." } };

  return callAction<DocumentDto>({
    path: "/documents/request",
    body: {
      title,
      kind: String(formData.get("kind") ?? "OTHER"),
      employeeId: String(formData.get("employeeId") ?? ""),
      message: String(formData.get("message") ?? "") || undefined,
    },
    message: "Asked. They will see it in their documents.",
  });
}

/** The employee answering a request with the file that was asked for. */
export async function submitDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState<DocumentDto>> {
  const id = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose the file to send." } };
  }

  const body = new FormData();
  body.set("file", file);

  try {
    const record = await apiUpload<DocumentDto>(`/documents/${id}/submit`, body);
    return { ok: true, record, message: "Sent. They have it now." };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function signDocument(
  id: string,
  signatureImage: string,
  typedName: string,
): Promise<FormState<DocumentDto>> {
  if (!signatureImage) {
    return { error: "Draw or type your signature first." };
  }
  if (!typedName.trim()) {
    return { error: "Type your name to confirm." };
  }

  return callAction<DocumentDto>({
    path: `/documents/${id}/sign`,
    body: { signatureImage, typedName },
    message: "Signed. A copy with the certificate is in your documents.",
  });
}

export async function declineDocument(
  id: string,
  reason: string,
): Promise<FormState<DocumentDto>> {
  return callAction<DocumentDto>({
    path: `/documents/${id}/decline`,
    body: { reason },
    message: "Declined. They have been told why.",
  });
}

export async function sendDocument(id: string): Promise<FormState<DocumentDto>> {
  return callAction<DocumentDto>({
    path: `/documents/${id}/send`,
    message: "Sent.",
  });
}

export async function cancelDocument(id: string): Promise<FormState<DocumentDto>> {
  return callAction<DocumentDto>({
    path: `/documents/${id}/cancel`,
    message: "Withdrawn.",
  });
}

/** What the model suggested about an uploaded file. Nothing is created. */
export type DocumentSuggestion = {
  title: string;
  kind: string;
  personName: string | null;
  needsSignature: boolean;
  summary: string;
};

/**
 * Reads an uploaded PDF and suggests how to file it.
 *
 * The answer only fills in the form. It is a model's reading of a document
 * this system did not write, so a person confirms every field before anything
 * is saved.
 */
export async function analyseDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState<DocumentSuggestion>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a PDF to read." } };
  }

  const body = new FormData();
  body.set("file", file);

  try {
    const record = await apiUpload<DocumentSuggestion>(
      "/documents/analyse",
      body,
    );
    return { ok: true, record, message: "Read it." };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

/**
 * Has the model write a document, which lands as a draft.
 *
 * It goes nowhere until someone reads it: the text comes from an employee
 * record plus free-form notes, and neither this action nor the model can tell
 * whether what came back is correct for the person it is about.
 */
export async function draftDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState<DocumentDto>> {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) {
    return { fieldErrors: { employeeId: "Choose who it is for." } };
  }

  return callAction<DocumentDto>({
    path: "/documents/draft",
    body: {
      kind: String(formData.get("kind") ?? "JOINING_LETTER"),
      employeeId,
      notes: String(formData.get("notes") ?? "") || undefined,
      requiresSignature: formData.get("requiresSignature") === "true",
    },
    message: "Written. Read it through before sending it.",
  });
}
