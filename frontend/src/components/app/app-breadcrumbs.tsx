"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui";

/** One label per route segment, so no page has to declare its own trail. */
const LABELS: Record<string, string> = {
  employees: "Employees",
  contracts: "Contracts",
  attendance: "Attendance",
  "time-off": "Time off",
  payruns: "Pay runs",
  payslips: "Payslips",
  salary: "Salary",
  settings: "Settings",
  profile: "My profile",
  new: "New",
};

/**
 * Record ids are opaque cuids, so a detail crumb names the kind of thing and
 * the page heading carries the real name.
 */
const DETAIL_LABELS: Record<string, string> = {
  employees: "Employee",
  contracts: "Contract",
  payruns: "Pay run",
  payslips: "Payslip",
};

function labelFor(segment: string, parent: string | undefined) {
  // A named segment wins over the detail fallback, so "/payruns/new" is not
  // mistaken for a record id.
  if (LABELS[segment]) return LABELS[segment];
  if (parent && DETAIL_LABELS[parent]) return DETAIL_LABELS[parent];
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // The overview is the root, so it leads the trail everywhere else and is the
  // current page at "/".
  const crumbs = [
    { label: "Overview", href: "/", isLast: segments.length === 0 },
    ...segments.map((segment, index) => ({
      label: labelFor(segment, segments[index - 1]),
      href: `/${segments.slice(0, index + 1).join("/")}`,
      isLast: index === segments.length - 1,
    })),
  ];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb) => (
          <React.Fragment key={crumb.href}>
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {crumb.isLast ? null : <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
