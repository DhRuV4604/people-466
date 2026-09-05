import { redirect } from "next/navigation";
import {
  can,
  scopeToOwnRecords,
  type AuthUser,
  type Module,
} from "@peoplepay360/shared";

import { getSession } from "@/lib/session";

/** The self-service space. Anyone with an employee record can open it. */
export const ME = "/me";

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
  // Someone who only ever sees their own rows has no use for the admin panel:
  // every list there would hold one line. Their space is built for that.
  if (scopeToOwnRecords(user.role) && user.employeeId) return ME;

  return (
    LANDING.find((entry) => can(user.role, entry.module, "read"))?.href ??
    "/profile"
  );
}

/**
 * Whether this account has a self-service space at all. An admin who is not on
 * the payroll has no attendance, leave or payslips of their own to show.
 */
export function hasMe(user: AuthUser): boolean {
  return Boolean(user.employeeId);
}

/**
 * Guards the self-service space. The one thing it needs is a linked employee
 * record; without one there is nothing to render, so the visitor goes to the
 * first admin screen their role can open instead.
 */
export async function requireMe(): Promise<AuthUser & { employeeId: string }> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!user.employeeId) redirect(landingFor(user));
  return user as AuthUser & { employeeId: string };
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
