import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { can, scopeToOwnRecords, type EmployeeDetailDto } from "@peoplepay360/shared";

import { Notifications } from "@/components/app/notifications";
import { ThemeTogglerButton, UserAvatar, buttonVariants } from "@/components/ui";
import { requireMe, landingFor } from "@/lib/access";
import { ApiError, apiFetch } from "@/lib/api-client";

import { MeNav } from "./_components/me-nav";

export const metadata: Metadata = {
  title: { default: "My space", template: "%s · My space" },
};

/**
 * The self-service shell. No sidebar, no breadcrumbs, no tables: one column
 * that reads on a phone, with the five places an employee actually goes on a
 * bar under their thumb. The admin panel is a different product for a
 * different job, and nothing about its shape is borrowed here.
 *
 * Anyone with an employee record may use it — an HR manager on the payroll
 * checks in here too — and a link back to the panel appears for roles that
 * have one.
 */
export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireMe();

  // The header names the person's role in the company, not their sign-in role.
  // Soft-failed: an unreachable API should still let the shell render.
  let employee: EmployeeDetailDto | null = null;
  try {
    employee = await apiFetch<EmployeeDetailDto>(`/employees/${user.employeeId}`);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }

  const subtitle = [employee?.jobPosition?.name, employee?.department?.name]
    .filter(Boolean)
    .join(" · ");

  const hasPanel = !scopeToOwnRecords(user.role);
  const showPay = can(user.role, "payslips", "read");

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          <Link
            href="/me/profile"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <UserAvatar name={user.name} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">
                {user.name}
              </span>
              {subtitle ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {subtitle}
                </span>
              ) : null}
            </span>
          </Link>

          <div className="hidden md:block">
            <MeNav variant="top" showPay={showPay} />
          </div>

          <Notifications />

          {hasPanel ? (
            <Link
              href={landingFor({ ...user, employeeId: null })}
              title="Open the admin panel"
              className={buttonVariants({ variant: "ghost", size: "icon" })}
            >
              <LayoutDashboard />
              <span className="sr-only">Open the admin panel</span>
            </Link>
          ) : null}

          <ThemeTogglerButton variant="ghost" modes={["light", "dark", "system"]} />
        </div>
      </header>

      {/* Bottom padding clears the fixed bar on a phone; on a desktop there is
          no bar, so the page just breathes. */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-5 pb-28 md:pb-10">
        {children}
      </main>

      <MeNav variant="bottom" showPay={showPay} />
    </div>
  );
}
