import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AtSign, Fingerprint, IdCard, ShieldCheck } from "lucide-react";
import {
  ROLE_LABELS,
  can,
  scopeToOwnRecords,
  visibleModules,
  type Action,
  type Module,
} from "@peoplepay360/shared";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  UserAvatar,
} from "@/components/ui";
import { verifySession } from "@/lib/session";

export const metadata: Metadata = {
  title: "My profile",
  description: "Your account and what your role can do.",
};

const MODULE_LABELS: Record<Module, string> = {
  employees: "Employees",
  contracts: "Contracts",
  workingSchedules: "Working schedules",
  attendance: "Attendance",
  timeOffRequests: "Time off requests",
  timeOffAllocations: "Time off allocations",
  timeOffTypes: "Time off types",
  payruns: "Pay runs",
  payslips: "Payslips",
  salaryStructures: "Salary structures",
  salaryRules: "Salary rules",
  dashboard: "Dashboard",
  auditLogs: "Audit trail",
};

const ACTIONS: Action[] = ["read", "create", "update", "delete", "approve"];
const ACTION_LABELS: Record<Action, string> = {
  read: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  approve: "Approve",
};

export default async function ProfilePage() {
  // Read from the API rather than the cookie, so a role changed by an admin
  // shows up here rather than being cached until the next sign-in.
  const user = await verifySession();
  if (!user) redirect("/login");

  const roleLabel = ROLE_LABELS[user.role];
  const modules = visibleModules(user.role);

  const facts = [
    { icon: AtSign, label: "Email", value: user.email },
    { icon: ShieldCheck, label: "Role", value: roleLabel },
    {
      icon: IdCard,
      label: "Employee record",
      value: user.employeeId ? "Linked" : "Not linked",
    },
    { icon: Fingerprint, label: "User ID", value: user.id },
  ];

  return (
    <>

      {/* A grid item is min-width:auto by default, so an unbreakable value —
          the user id is a cuid — would widen the column past the viewport. */}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit min-w-0">
          <CardHeader className="items-start gap-4">
            <UserAvatar name={user.name} size="lg" />
            <div>
              <CardTitle>{user.name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
            <Badge variant="secondary">{roleLabel}</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            <dl className="flex flex-col gap-4">
              {facts.map((fact) => (
                <div key={fact.label} className="flex items-start gap-3">
                  <fact.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {fact.label}
                    </dt>
                    <dd className="truncate font-mono text-xs">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Every area {roleLabel} can open, and what they can do inside it.
              {scopeToOwnRecords(user.role)
                ? " This role only ever sees rows tied to its own employee record."
                : null}{" "}
              The API enforces this; the table is read from the same matrix.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-4 font-medium">Area</th>
                    {ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="p-4 text-center text-xs font-medium text-muted-foreground"
                      >
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => (
                    <tr
                      key={module}
                      className="border-b border-border last:border-0"
                    >
                      <td className="p-4">{MODULE_LABELS[module]}</td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="p-4 text-center">
                          {can(user.role, module, action) ? (
                            <span
                              aria-label="Allowed"
                              className="inline-block size-1.5 rounded-full bg-primary"
                            />
                          ) : (
                            <span
                              aria-label="Not allowed"
                              className="inline-block size-1.5 rounded-full bg-border"
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
