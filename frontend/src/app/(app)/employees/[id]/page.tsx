import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Banknote, Landmark } from "lucide-react";
import { can } from "@peoplepay360/shared";

import {
  LeaveBalances,
  loadBalances,
} from "@/app/(app)/time-off/_components/leave-balances";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireAccess } from "@/lib/access";

import { employeeTabAccess, getEmployee } from "./_lib";

type PageProps = { params: Promise<{ id: string }> };

export default async function EmployeeOverviewPage({ params }: PageProps) {
  const session = await requireAccess("employees");

  const { id } = await params;
  const canReadBalances = can(session.role, "timeOffAllocations", "read");

  const [employee, balances] = await Promise.all([
    getEmployee(id),
    // The API pins an Employee to their own balances whatever id is asked for,
    // which is safe here because the same role gets a 404 on anyone else's
    // record and never reaches this page with someone else's id.
    canReadBalances ? loadBalances(id) : null,
  ]);
  if (!employee) notFound();

  const access = employeeTabAccess(session.role);
  const base = `/employees/${employee.id}`;

  // What an admin opening this record would otherwise have to go and find out
  // module by module. Each line links to the tab that fixes it.
  const attention: { text: string; href?: string }[] = [];
  if (!employee.hasBankDetails) {
    attention.push({
      text: "No bank details, so payroll cannot pay this employee.",
    });
  }
  if (access.contracts && employee.counts.contracts === 0) {
    attention.push({
      text: "No contract, so a pay run has no wage to compute from.",
      href: `${base}/contracts`,
    });
  }

  const activity = [
    { label: "Contracts", value: employee.counts.contracts, href: access.contracts ? `${base}/contracts` : undefined },
    { label: "Attendance records", value: employee.counts.attendances, href: access.attendance ? `${base}/attendance` : undefined },
    { label: "Time off requests", value: employee.counts.leaveRequests, href: access.timeOff ? `${base}/time-off` : undefined },
    { label: "Allocations", value: employee.counts.leaveAllocations, href: access.timeOff ? `${base}/time-off?tab=allocations` : undefined },
    { label: "Payslips", value: employee.counts.payslips, href: access.payslips ? `${base}/payslips` : undefined },
  ];

  return (
    <>
      {attention.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {attention.map((item) => (
                <li key={item.text}>
                  {item.href ? (
                    <Link href={item.href} className="underline underline-offset-4">
                      {item.text}
                    </Link>
                  ) : (
                    item.text
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Payroll readiness first: it is the thing that blocks a pay run. */}
      <Card
        className={employee.hasBankDetails ? undefined : "border-destructive/40"}
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
              Add a bank name and account number to make this employee payable.
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
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {activity.map((item) => {
              const figure = (
                <>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {item.value}
                  </dd>
                  <dt className="text-xs text-muted-foreground">
                    {item.label}
                  </dt>
                </>
              );

              // A count is the obvious way in to the rows behind it, but only
              // for a tab this role can actually open.
              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-lg outline-none transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  {figure}
                </Link>
              ) : (
                <div key={item.label}>{figure}</div>
              );
            })}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
