"use server";

import { redirect } from "next/navigation";

import { landingFor } from "@/lib/access";
import { ApiError } from "@/lib/api-client";
import { login } from "@/lib/session";

export type LoginState = {
  error?: string;
  /** Field-level messages keyed by input name. */
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

/**
 * Signs in against the API and sets the session cookies. Runs on the server,
 * so the token is never exposed to the browser. Returns a message on failure
 * and redirects on success.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const fieldErrors: LoginState["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fieldErrors.email = "That doesn't look like a valid email address.";
  if (!password) fieldErrors.password = "Enter your password.";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  let landing: string;
  try {
    const { user } = await login(email, password);
    // Not every role can open the overview, so the first screen is whichever
    // one the role can actually read.
    landing = landingFor(user);
  } catch (error) {
    if (error instanceof ApiError) {
      // 401 is the API's deliberate catch-all for unknown email, wrong
      // password and deactivated account, so it cannot be used to discover
      // which addresses exist.
      return { error: error.message };
    }
    throw error;
  }

  redirect(landing);
}
