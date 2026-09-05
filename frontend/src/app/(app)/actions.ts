"use server";

import { redirect } from "next/navigation";

import { logout } from "@/lib/session";

/** Clears the session cookies and returns to the login screen. */
export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
