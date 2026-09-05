import * as React from "react";
import { redirect } from "next/navigation";

import { AppBreadcrumbs } from "@/components/app/app-breadcrumbs";
import { AppSidebar } from "@/components/app/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui";
import { getSession } from "@/lib/session";

/**
 * The signed-in shell: collapsible sidebar on the left, a sticky bar carrying
 * the breadcrumb trail, and the page itself in the inset. Every route in this
 * group gets it, so pages only render their own content.
 *
 * This is also the gate: without a session cookie there is nothing to render,
 * so the visitor goes back to the login screen. The API re-checks the token on
 * every request, so this is a redirect for the user's benefit rather than the
 * security boundary.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      {/* min-w-0 lets the inset shrink below its content width, so long rows
          truncate instead of pushing the page sideways. */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <AppBreadcrumbs />
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
