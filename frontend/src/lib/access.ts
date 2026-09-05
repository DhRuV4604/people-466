import { redirect } from "next/navigation";
import { can, type AuthUser, type Module } from "@peoplepay360/shared";

import { getSession } from "@/lib/session";

/**
 * The first screen a role can actually open. Employees is readable by every
 * role, so it is the safe landing place when someone reaches a page their role
 * cannot see, including the overview.
 */
const LANDING: { module: Module; href: string }[] = [
  { module: "dashboard", href: "/" },
  { module: "employees", href: "/employees" },
  { module: "attendance", href: "/attendance" },
  { module: "timeOffRequests", href: "/time-off" },
];

export function landingFor(user: AuthUser): string {
  return (
    LANDING.find((entry) => can(user.role, entry.module, "read"))?.href ??
    "/profile"
  );
}

/**
 * Guards a page. Signed out visitors go to login; signed in visitors without
 * the permission go to the first screen their role can open, rather than
 * seeing the API's 403 as a crash.
 *
 * The API re-checks on every request, so this is for the user's benefit and
 * never the security boundary.
 */
export async function requireAccess(module: Module): Promise<AuthUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!can(user.role, module, "read")) redirect(landingFor(user));
  return user;
}

/** For pages with no module of their own, such as the profile. */
export async function requireSession(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}
