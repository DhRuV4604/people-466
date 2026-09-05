"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  CalendarOff,
  ChevronsUpDown,
  FileSignature,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  ScrollText,
  Settings,
  Sliders,
  Smile,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";
import {
  ROLE_LABELS,
  can,
  type Action,
  type AuthUser,
  type Module,
} from "@peoplepay360/shared";

import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  UserAvatar,
} from "@/components/ui";
import { Users } from "@/components/animate-ui/icons/users";
import { logoutAction } from "@/app/(app)/actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The permission that decides whether this appears at all. */
  module: Module;
  /**
   * The action to check, when reading is not the point of the screen. Settings
   * is the case: every role may read a working schedule, but only the roles
   * that can change one have any reason to open the page.
   */
  action?: Action;
};

/**
 * Navigation mirrors how the product is used: who works here, what they do day
 * to day, what they get paid, and the settings behind it. Every item is gated
 * on the same permission matrix the API enforces, so a role never sees a link
 * that would fail when clicked.
 */
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/",
        label: "Overview",
        icon: LayoutDashboard,
        module: "dashboard",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        href: "/employees",
        label: "Employees",
        icon: UsersRound,
        module: "employees",
      },
      {
        href: "/contracts",
        label: "Contracts",
        icon: FileText,
        module: "contracts",
      },
      {
        href: "/documents",
        label: "Documents",
        icon: FileSignature,
        module: "documents",
      },
    ],
  },
  {
    label: "Time",
    items: [
      {
        href: "/attendance",
        label: "Attendance",
        icon: CalendarClock,
        module: "attendance",
      },
      {
        href: "/time-off",
        label: "Time off",
        icon: CalendarOff,
        module: "timeOffRequests",
      },
    ],
  },
  {
    label: "Payroll",
    items: [
      { href: "/payruns", label: "Pay runs", icon: Wallet, module: "payruns" },
      {
        href: "/payslips",
        label: "Payslips",
        icon: Receipt,
        module: "payslips",
      },
      {
        href: "/salary",
        label: "Salary",
        icon: Sliders,
        module: "salaryStructures",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/settings",
        label: "Settings",
        action: "update",
        icon: Settings,
        module: "workingSchedules",
      },
      {
        href: "/audit",
        label: "Audit trail",
        icon: ScrollText,
        module: "auditLogs",
      },
    ],
  },
];

export function AppSidebar({
  user,
  /** Where the wordmark goes. Not every role can open the overview. */
  home = "/",
}: {
  user: AuthUser;
  home?: string;
}) {
  const pathname = usePathname();
  const roleLabel = ROLE_LABELS[user.role];

  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      can(user.role, item.module, item.action ?? "read"),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="PeoplePay360">
              <Link href={home}>
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Users size={17} />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">PeoplePay360</span>
                  <span className="truncate text-xs text-muted-foreground">
                    HR &amp; Payroll
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* gap-0 and a tighter group padding: the default spacing pushed the last
          group past the viewport on a laptop, and a scrollbar on five items is
          noise. It still scrolls when it genuinely has to. */}
      <SidebarContent className="scrollbar-thin gap-0">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="h-7">{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                // The overview owns "/" exactly; every other item also matches
                // its own detail pages.
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={`${user.name} · ${roleLabel}`}
                >
                  <UserAvatar
                    name={user.name}
                    size="sm"
                    className="shrink-0 rounded-lg"
                  />
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {roleLabel}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                side="right"
                sideOffset={8}
                className="w-64"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={user.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuLabel className="pt-0 pb-2">
                  <Badge variant="secondary">{roleLabel}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLinkItem href="/profile">
                  <UserRound />
                  My profile
                </DropdownMenuLinkItem>
                {/* Only an account tied to an employee record has attendance,
                    leave and payslips of its own to see. */}
                {user.employeeId ? (
                  <DropdownMenuLinkItem href="/me">
                    <Smile />
                    My space
                  </DropdownMenuLinkItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logoutAction()}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
