import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { getSession } from "@/lib/session";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Choose a password",
  description: "Replace the one-time password your invite carried.",
};

/**
 * Outside the app shell on purpose: someone still on an issued password has
 * nothing to navigate to yet, and a sidebar full of screens they are about to
 * be redirected away from would only be in the way.
 */
export default async function ChangePasswordPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const invited = user.mustChangePassword;

  return (
    <AuthShell>
      <ChangePasswordForm
        name={user.name}
        // Someone who chose to come here is not being told they must.
        invited={invited}
      />
    </AuthShell>
  );
}
