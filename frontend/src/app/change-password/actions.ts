"use server";

import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api-client";
import { landingFor } from "@/lib/access";
import { getSession, refreshSession } from "@/lib/session";

export type ChangePasswordState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"currentPassword" | "newPassword" | "confirmPassword", string>
  >;
};

/**
 * Replaces the password on the signed-in account.
 *
 * The confirmation is checked here rather than by the API: it exists to catch
 * a typo in the box, which is a browser concern, and sending it would mean the
 * API validating a field that is not part of the change.
 */
export async function changePasswordAction(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: ChangePasswordState["fieldErrors"] = {};
  if (!currentPassword) {
    fieldErrors.currentPassword = "Enter the password you signed in with.";
  }
  if (newPassword.length < 8) {
    fieldErrors.newPassword = "Choose at least 8 characters.";
  }
  if (confirmPassword !== newPassword) {
    fieldErrors.confirmPassword = "This does not match the new password.";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    await apiFetch("/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  // The session cookie still says the password must change, so it is re-read
  // from the API before leaving; otherwise the guard would send them straight
  // back here.
  const user = (await refreshSession()) ?? (await getSession());
  redirect(user ? landingFor(user) : "/login");
}
