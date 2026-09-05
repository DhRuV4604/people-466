import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Banknote,
  Building2,
  CalendarDays,
  Clock,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserRound,
} from "lucide-react";
import { can, type EmployeeDetailDto } from "@peoplepay360/shared";

import {
  LeaveBalances,
  loadBalances,
} from "@/app/(app)/time-off/_components/leave-balances";
import { ActionButton, RecordDialog } from "@/components/form";
import {
  BackLink,
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
import { ApiError, apiFetch } from "@/lib/api-client";
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

type PageProps = { params: Promise<{ id: string }> };

async function getEmployee(id: string): Promise<EmployeeDetailDto | null> {
  try {
    return await apiFetch<EmployeeDetailDto>(`/employees/${id}`);
  } catch (error) {
    // The API answers 404 both for a missing record and for one this role may
    // not see, so the page cannot be used to probe for ids.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const employee = await getEmployee(id);
  return { title: employee?.fullName ?? "Employee" };
}

export default async function EmployeePage({ params }: PageProps) {
  const session = await requireAccess("employees");

  const { id } = await params;
  const canUpdate = can(session.role, "employees", "update");
  const canDelete = can(session.role, "employees", "delete");
  const canReadBalances = can(session.role, "timeOffAllocations", "read");

  const [employee, refs, balances] = await Promise.all([
    getEmployee(id),
    // Only the edit form needs them, so a role that can only read this record
    // does not pay for four extra lookups.
    canUpdate
      ? loadRefs(["departments", "positions", "schedules", "employees"])
      : null,
    // The API pins an Employee to their own balances whatever id is asked for,
    // which is safe here because the same role gets a 404 on anyone else's
    // record and never reaches this page with someone else's id.
    canReadBalances ? loadBalances(id) : null,
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

  const activity = [
    { label: "Contracts", value: employee.counts.contracts },
    { label: "Attendance records", value: employee.counts.attendances },
    { label: "Time off requests", value: employee.counts.leaveRequests },
    { label: "Allocations", value: employee.counts.leaveAllocations },
    { label: "Payslips", value: employee.counts.payslips },
  ];

  return (
    <>
      <PageHeader
        above={<BackLink href="/employees">All employees</BackLink>}
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

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-wrap items-start gap-4">
              <UserAvatar name={employee.fullName} size="lg" />
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
                  <div
                    key={detail.label}
                    className="flex items-start gap-3"
                  >
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
        </div>

        <div className="flex flex-col gap-6">
          {/* Payroll readiness first: it is the thing that blocks a pay run. */}
          <Card
            className={
              employee.hasBankDetails ? undefined : "border-destructive/40"
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="size-4" />
                Payroll details
              </CardTitle>
              <CardDescription>
                {employee.hasBankDetails
                  ? "Ready to be included in a pay run."
                  : "Payroll cannot pay this employee until bank details are added."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Bank</p>
                <p className="text-sm">{employee.bankName ?? "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account</p>
                <p className="font-mono text-sm">
                  {employee.bankAccountNumber ?? "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hired</p>
                <p className="text-sm">{formatDate(employee.hireDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exit date</p>
                <p className="text-sm">
                  {employee.exitDate ? formatDate(employee.exitDate) : "—"}
                </p>
              </div>
              {!employee.hasBankDetails ? (
                <div className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
                  <Banknote className="size-4 shrink-0" />
                  Add a bank name and account number to make this employee
                  payable.
                </div>
              ) : null}
            </CardContent>
          </Card>


          {balances ? (
            <LeaveBalances
              rows={balances}
              description={`Where ${employee.fullName} stands today: approved allocations less approved leave.`}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Record</CardTitle>
              <CardDescription>
                What exists against this employee across the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {activity.map((item) => (
                  <div key={item.label}>
                    <dd className="text-xl font-semibold tabular-nums sm:text-2xl">
                      {item.value}
                    </dd>
                    <dt className="text-xs text-muted-foreground">
                      {item.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
