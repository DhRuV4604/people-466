import Link from "next/link";
import { Banknote, Building2, CalendarDays, Mail, UserRound } from "lucide-react";
import type { EmployeeSummaryDto } from "@peoplepay360/shared";

import { RowActions } from "@/components/form";
import { Badge, Card, Tooltip, TooltipContent, TooltipTrigger, UserAvatar } from "@/components/ui";
import {
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_TONE,
  EMPLOYEE_TYPE_LABELS,
  formatDate,
} from "@/lib/format";

import { deleteEmployee } from "../actions";

type ViewProps = {
  employees: EmployeeSummaryDto[];
  /**
   * Adds the row menu. Editing lives on the record itself, where the whole
   * employee is loaded and no field can be blanked by accident.
   */
  canDelete?: boolean;
};

/** Warns that payroll cannot pay this person yet. */
function BankWarning() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <Banknote className="size-3.5" />
          <span className="sr-only">Missing bank details</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Missing bank details</TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ employee }: { employee: EmployeeSummaryDto }) {
  return (
    <Badge variant={EMPLOYEE_STATUS_TONE[employee.status]}>
      {EMPLOYEE_STATUS_LABELS[employee.status]}
    </Badge>
  );
}

function DeleteMenu({ employee }: { employee: EmployeeSummaryDto }) {
  return (
    <div className="relative z-10 shrink-0">
      <RowActions
        remove={{
          action: deleteEmployee.bind(null, employee.id),
          title: `Delete ${employee.fullName}?`,
          // The list DTO carries no payslip count, so the copy has to cover
          // both outcomes: the API archives rather than deletes once payroll
          // history exists.
          description:
            "This removes the employee and everything filed under them: contracts, attendance and time off. Someone who already has payslips is marked inactive instead, so payroll history survives.",
        }}
      />
    </div>
  );
}

/** Dense rows. Best for scanning many people and comparing one column. */
export function EmployeeList({ employees, canDelete }: ViewProps) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {employees.map((employee) => (
        // The link covers the row rather than wrapping it, so the row menu can
        // sit inside without nesting one control in another.
        <li
          key={employee.id}
          className="relative flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
        >
          <Link
            href={`/employees/${employee.id}`}
            className="absolute inset-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset"
          >
            <span className="sr-only">Open {employee.fullName}</span>
          </Link>

          <UserAvatar name={employee.fullName} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{employee.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {employee.jobPosition?.name ?? "No position"} ·{" "}
              {employee.workEmail}
            </p>
          </div>

          <span className="hidden w-36 shrink-0 truncate text-xs text-muted-foreground xl:block">
            {employee.department?.name ?? "—"}
          </span>

          <span className="hidden w-24 shrink-0 font-mono text-xs text-muted-foreground md:block">
            {employee.employeeCode}
          </span>

          <Badge variant="outline" className="hidden shrink-0 lg:inline-flex">
            {EMPLOYEE_TYPE_LABELS[employee.employeeType]}
          </Badge>

          {!employee.hasBankDetails ? <BankWarning /> : null}

          <StatusBadge employee={employee} />

          {canDelete ? <DeleteMenu employee={employee} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Cards. Best for browsing, and for seeing each person as a person. */
export function EmployeeCards({ employees, canDelete }: ViewProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {employees.map((employee) => (
        <li key={employee.id}>
          <Card className="relative h-full transition-colors hover:border-primary/40">
            <Link
              href={`/employees/${employee.id}`}
              className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <span className="sr-only">Open {employee.fullName}</span>
            </Link>

            <div className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <UserAvatar name={employee.fullName} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{employee.fullName}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {employee.jobPosition?.name ?? "No position"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {employee.employeeCode}
                  </p>
                </div>
                <StatusBadge employee={employee} />
                {canDelete ? <DeleteMenu employee={employee} /> : null}
              </div>

              <dl className="flex flex-col gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 shrink-0" />
                  <dt className="sr-only">Department</dt>
                  <dd className="truncate">
                    {employee.department?.name ?? "No department"}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 shrink-0" />
                  <dt className="sr-only">Email</dt>
                  <dd className="truncate">{employee.workEmail}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound className="size-3.5 shrink-0" />
                  <dt className="sr-only">Manager</dt>
                  <dd className="truncate">
                    {employee.manager?.fullName ?? "No manager"}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-3.5 shrink-0" />
                  <dt className="sr-only">Hired</dt>
                  <dd className="truncate">
                    Hired {formatDate(employee.hireDate)}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex items-center gap-2 border-t border-border pt-4">
                <Badge variant="outline">
                  {EMPLOYEE_TYPE_LABELS[employee.employeeType]}
                </Badge>
                {!employee.hasBankDetails ? (
                  <Badge variant="destructive">No bank details</Badge>
                ) : null}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
