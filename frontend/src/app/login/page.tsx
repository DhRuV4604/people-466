import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  // Already signed in: no reason to show the form again.
  const session = await getSession();
  if (session) redirect("/");

  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
