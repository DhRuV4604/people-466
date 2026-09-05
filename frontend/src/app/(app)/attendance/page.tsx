import type { Metadata } from "next";
import { CalendarClock, LogIn, LogOut } from "lucide-react";
import {
  ATTENDANCE_STATUSES,
  can,
  type AttendanceDto,
  type AttendanceSummaryDto,
} from "@peoplepay360/shared";

import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import {
  EmptyState,
  PersonCell,
  StatGrid,
  StatTile,
} from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { ActionButton, RecordDialog, RowActions } from "@/components/form";
import { Badge } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { formatDate, formatTime, hours, percent } from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import { attendanceEditFields, attendanceFields } from "./fields";
import {
  checkIn,
  checkOut,
  correctAttendance,
  deleteAttendance,
  saveAttendance,
} from "./actions";

export const metadata: Metadata = {
  title: "Attendance",
  description: "Punches, exceptions and corrections.",
};

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("attendance");

  const params = await searchParams;
  const [records, summary, refs] = await Promise.all([
    apiFetch<AttendanceDto[]>("/attendance", {
      query: { q: params.q, status: params.status, limit: 200 },
    }),
    apiFetch<AttendanceSummaryDto>("/attendance/summary"),
    loadRefs(["employees"]),
  ]);

  const canCreate = can(session.role, "attendance", "create");
  const canUpdate = can(session.role, "attendance", "update");
  const canDelete = can(session.role, "attendance", "delete");

  // The punches record the signed-in user's own attendance, so an account with
  // no employee behind it has nothing to punch.
  const canPunch = canCreate && Boolean(session.employeeId);

  // The list DTO is the whole record, so an edit here cannot blank a column
  // the form never showed. Built once rather than per row, so the same list
  // crosses to the client once however many rows there are.
  const editFields = attendanceEditFields();

  const rowActions: Column<AttendanceDto>[] =
    canUpdate || canDelete
      ? [
          {
            className: "w-10",
            align: "right",
            cell: (row) => (
              <RowActions
                edit={
                  canUpdate
                    ? {
                        title: "Correct entry",
                        description:
                          "Saving here flags the entry as edited by hand, and records who changed it and why.",
                        fields: editFields,
                        action: correctAttendance,
                        // Spread because the form takes a plain record, and a
                        // DTO interface carries no index signature.
                        record: { ...row },
                      }
                    : undefined
                }
                remove={
                  canDelete
                    ? {
                        action: deleteAttendance.bind(null, row.id),
                        title: "Delete this entry?",
                        description: `The punches for ${row.employee?.fullName ?? "this employee"} on ${formatDate(row.checkIn)} are removed, along with the hours payroll reads from them. This cannot be undone.`,
                      }
                    : undefined
                }
              />
            ),
          },
        ]
      : [];

  return (
    <>
      <StatGrid>
        <StatTile
          label="Health"
          value={percent(summary.healthPercent)}
          hint={`${summary.totalRecords} records`}
          tone={summary.healthPercent < 80 ? "danger" : "neutral"}
        />
        <StatTile
          label="Worked"
          value={hours(summary.totalWorkedHours)}
          hint={`${hours(summary.totalOvertimeHours)} overtime`}
        />
        <StatTile
          label="Exceptions"
          value={summary.late + summary.absent + summary.missingCheckout}
          hint={`${summary.late} late · ${summary.absent} absent · ${summary.missingCheckout} no check-out`}
          tone={
            summary.late + summary.absent + summary.missingCheckout > 0
              ? "danger"
              : "neutral"
          }
        />
        <StatTile
          label="Manual edits"
          value={summary.manualEdits}
          hint="Corrected by a person"
        />
      </StatGrid>

      <FilterBar
        search={{ placeholder: "Search employee" }}
        selects={[
          {
            key: "status",
            placeholder: "Any status",
            options: statusOptions(ATTENDANCE_STATUSES),
            width: "w-44",
          },
        ]}
        quickFilters={[
          { key: "status", value: "MISSING_CHECKOUT", label: "No check-out" },
          { key: "status", value: "LATE", label: "Late" },
          { key: "status", value: "ABSENT", label: "Absent" },
        ]}
        count={{ total: records.length, noun: "record" }}
        actions={
          canCreate ? (
            <>
              {canPunch ? (
                <>
                  <ActionButton
                    action={checkIn}
                    variant="outline"
                    size="sm"
                    startIcon={<LogIn />}
                    pendingLabel="Checking in"
                  >
                    Check in
                  </ActionButton>
                  <ActionButton
                    action={checkOut}
                    variant="outline"
                    size="sm"
                    startIcon={<LogOut />}
                    pendingLabel="Checking out"
                  >
                    Check out
                  </ActionButton>
                </>
              ) : null}

              <RecordDialog
                title="Record attendance"
                description="For a shift the clock missed. Leave the check-out blank if the shift is still running."
                fields={attendanceFields(refs)}
                action={saveAttendance}
                submitLabel="Record attendance"
              />
            </>
          ) : null
        }
      />

      {records.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No attendance records match"
          description="Try a broader search, or clear a filter to widen the results."
        />
      ) : (
        <DataTable
          rows={records}
          getKey={(row) => row.id}
          columns={[
            {
              header: "Employee",
              className: "min-w-[180px]",
              cell: (row) => (
                <PersonCell
                  name={row.employee?.fullName ?? "Unknown"}
                  meta={row.employee?.department}
                  href={`/employees/${row.employeeId}`}
                />
              ),
            },
            {
              header: "Date",
              cell: (row) => (
                <span className="whitespace-nowrap">
                  {formatDate(row.checkIn)}
                </span>
              ),
            },
            {
              header: "In",
              hideBelow: "sm",
              cell: (row) => (
                <span className="tabular-nums">{formatTime(row.checkIn)}</span>
              ),
            },
            {
              header: "Out",
              hideBelow: "sm",
              cell: (row) => (
                <span className="tabular-nums">{formatTime(row.checkOut)}</span>
              ),
            },
            {
              header: "Worked",
              align: "right",
              hideBelow: "md",
              cell: (row) => (
                <span className="tabular-nums">{hours(row.workedHours)}</span>
              ),
            },
            {
              header: "Overtime",
              align: "right",
              hideBelow: "lg",
              cell: (row) =>
                row.overtimeHours > 0 ? (
                  <span className="tabular-nums text-primary">
                    {hours(row.overtimeHours)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            {
              header: "Status",
              align: "right",
              cell: (row) => (
                <span className="inline-flex items-center gap-2">
                  {row.manuallyEdited ? (
                    <Badge variant="outline" title={row.editReason ?? undefined}>
                      Edited
                    </Badge>
                  ) : null}
                  <StatusBadge value={row.status} />
                </span>
              ),
            },
            ...rowActions,
          ]}
        />
      )}
    </>
  );
}
