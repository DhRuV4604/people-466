import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserRound,
} from "lucide-react";
import { can } from "@peoplepay360/shared";

import { AvatarPicker } from "@/components/employees/avatar-picker";
import { avatarUrl } from "@/lib/avatar";
import { BreadcrumbTitle } from "@/components/app/breadcrumb-title";
import { ActionButton, RecordDialog } from "@/components/form";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Separator,
  UserAvatar,
} from "@/components/ui";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONE,
  EMPLOYEE_TYPE_LABELS,
  formatDate,
} from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { requireAccess } from "@/lib/access";

import { deleteEmployeeAndReturn, saveEmployee } from "../actions";
import { employeeFields } from "../fields";
import { EmployeeTabs, type EmployeeTab } from "./_components/employee-tabs";
import { employeeTabAccess, getEmployee } from "./_lib";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const employee = await getEmployee(id);
  const name = employee?.fullName ?? "Employee";
  // Each tab sets its own title, and gets the person's name after it: an open
  // tab in a row of them should say whose attendance it is showing.
  return { title: { default: name, template: `%s · ${name}` } };
}

/**
 * The employee record, as one workspace.
 *
 * Everything filed against a person — attendance, leave, contracts, payslips —
 * is reachable and writable from here, so acting on one employee no longer
 * means visiting each module in turn and searching for them again. The
 * identity, the actions on the record itself and the tab strip are pinned
 * here; each tab supplies its own module underneath.
 */
export default async function EmployeeLayout({ children, params }: LayoutProps) {
  const session = await requireAccess("employees");

  const { id } = await params;
  const canUpdate = can(session.role, "employees", "update");
  const canDelete = can(session.role, "employees", "delete");

  const [employee, refs] = await Promise.all([
    getEmployee(id),
    // Only the edit form needs them, so a role that can only read this record
    // does not pay for four extra lookups.
    canUpdate
      ? loadRefs(["departments", "positions", "schedules", "employees"])
      : null,
  ]);
  if (!employee) notFound();

  // The API rejects an employee managing themselves, so it is never offered.
  const editFields = refs
    ? employeeFields({
        ...refs,
        employees: refs.employees.filter(
          (option) => option.value !== employee.id,
        ),
      })
    : [];

  // Payroll history is never destroyed: the API archives instead of deleting
  // once a payslip exists, and the confirmation has to say so.
  const willArchive = employee.counts.payslips > 0;

  const base = `/employees/${employee.id}`;
  const access = employeeTabAccess(session.role);

  // The counts ride along on the record, so the strip says how much is behind
  // each tab before anyone opens it.
  const tabs: EmployeeTab[] = [
    { href: base, label: "Overview" },
    ...(access.attendance
      ? [
          {
            href: `${base}/attendance`,
            label: "Attendance",
            count: employee.counts.attendances,
          },
        ]
      : []),
    ...(access.timeOff
      ? [
          {
            href: `${base}/time-off`,
            label: "Time off",
            count: employee.counts.leaveRequests,
          },
        ]
      : []),
    ...(access.contracts
      ? [
          {
            href: `${base}/contracts`,
            label: "Contracts",
            count: employee.counts.contracts,
          },
        ]
      : []),
    ...(access.payslips
      ? [
          {
            href: `${base}/payslips`,
            label: "Payslips",
            count: employee.counts.payslips,
          },
        ]
      : []),
    ...(access.documents
      ? [
          {
            href: `${base}/documents`,
            label: "Documents",
            count: employee.counts.documents,
          },
        ]
      : []),
  ];

  const details = [
    { icon: Mail, label: "Work email", value: employee.workEmail },
    { icon: Phone, label: "Work phone", value: employee.workPhone },
    { icon: Building2, label: "Department", value: employee.department?.name },
    { icon: UserRound, label: "Position", value: employee.jobPosition?.name },
    { icon: UserRound, label: "Manager", value: employee.manager?.fullName },
    { icon: Clock, label: "Schedule", value: employee.workingSchedule?.name },
    { icon: MapPin, label: "Address", value: employee.address },
    {
      icon: CalendarDays,
      label: "Date of birth",
      value: employee.dateOfBirth ? formatDate(employee.dateOfBirth) : null,
    },
  ];

  return (
    <>
      <BreadcrumbTitle>{employee.fullName}</BreadcrumbTitle>

      <PageHeader
        title={employee.fullName}
        description={`${employee.jobPosition?.name ?? "No position"} · ${
          employee.department?.name ?? "No department"
        }`}
        actions={
          canUpdate || canDelete ? (
            <>
              {canUpdate && refs ? (
                <RecordDialog
                  title="Edit employee"
                  description="The whole record is loaded here, so anything left blank is cleared."
                  fields={editFields}
                  action={saveEmployee}
                  record={{ ...employee }}
                  submitLabel="Save changes"
                  trigger={
                    <Button variant="outline" startIcon={<Pencil />}>
                      Edit employee
                    </Button>
                  }
                />
              ) : null}

              {canDelete ? (
                <ActionButton
                  variant="ghost"
                  startIcon={<Trash2 />}
                  action={deleteEmployeeAndReturn.bind(null, employee.id)}
                  pendingLabel="Deleting"
                  confirm={{
                    title: `Delete ${employee.fullName}?`,
                    description: willArchive
                      ? "This employee has payslips, so the record is kept for payroll history: they are marked inactive with today's exit date rather than removed."
                      : "This removes the employee and everything filed under them: contracts, attendance and time off. It cannot be undone.",
                    confirmLabel: willArchive ? "Archive" : "Delete",
                    destructive: true,
                  }}
                >
                  Delete
                </ActionButton>
              ) : null}
            </>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        {/* Who this is stays on screen while the tabs beside it change, so a
            correction is never filed against a half-remembered name. */}
        <Card className="lg:sticky lg:top-6">
          <CardHeader className="items-start gap-4">
            {canUpdate ? (
              <AvatarPicker
                employeeId={employee.id}
                name={employee.fullName}
                avatarFileId={employee.avatarFileId}
              />
            ) : (
              <UserAvatar
                name={employee.fullName}
                size="lg"
                src={avatarUrl(employee.id, employee.avatarFileId)}
              />
            )}
            <div className="min-w-0">
              <CardTitle>{employee.fullName}</CardTitle>
              <CardDescription className="font-mono text-xs">
                {employee.employeeCode}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={EMPLOYEE_STATUS_TONE[employee.status]}>
                {EMPLOYEE_STATUS_LABELS[employee.status]}
              </Badge>
              <Badge variant="outline">
                {EMPLOYEE_TYPE_LABELS[employee.employeeType]}
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            <dl className="flex flex-col gap-4">
              {details.map((detail) => (
                <div key={detail.label} className="flex items-start gap-3">
                  <detail.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {detail.label}
                    </dt>
                    <dd className="text-sm break-words">
                      {detail.value ?? "—"}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <EmployeeTabs base={base} tabs={tabs} />
          {children}
        </div>
      </div>
    </>
  );
}
