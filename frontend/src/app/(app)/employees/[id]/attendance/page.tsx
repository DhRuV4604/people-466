import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import {
  ATTENDANCE_STATUSES,
  can,
  type AttendanceDto,
  type AttendanceSummaryDto,
  type Paginated,
} from "@peoplepay360/shared";

import {
  attendanceEditFields,
  attendanceFields,
} from "@/app/(app)/attendance/fields";
import {
  PERIOD_OPTIONS,
  attendancePeriod,
} from "@/app/(app)/attendance/period";
import {
  correctAttendance,
  deleteAttendance,
} from "@/app/(app)/attendance/actions";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { EmptyState, StatGrid, StatTile } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { RecordDialog, RowActions } from "@/components/form";
import { Badge } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { withoutField } from "@/lib/fields";
import { dateRange, formatDate, formatTime, hours, percent } from "@/lib/format";
import { statusOptions } from "@/lib/status";

import { saveAttendanceFor } from "../actions";
import { requireEmployeeTab } from "../_lib";

export const metadata: Metadata = { title: "Attendance" };

type SearchParams = Promise<{
  status?: string;
  period?: string;
  page?: string;
  pageSize?: string;
}>;

/**
 * One employee's attendance, recorded and corrected without leaving their
 * record. The module screen is still where a whole team's punches are read
 * across; this is the same rows and the same writes, narrowed to one person by
 * the route rather than by a filter someone has to set.
 */
export default async function EmployeeAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { session, employee } = await requireEmployeeTab(id, "attendance");
  const query = await searchParams;

  // An unrecognised status is dropped rather than forwarded: the API answers a
  // bad enum with a 400, which would take the whole tab down.
  const status = ATTENDANCE_STATUSES.some((value) => value === query.status)
    ? query.status
    : undefined;

  const period = attendancePeriod(query.period);

  // The summary takes the same window and employee, so the tiles describe the
  // rows underneath them rather than some other slice of the year.
  const [recordPage, summary] = await Promise.all([
    apiFetch<Paginated<AttendanceDto>>("/attendance", {
      query: {
        ...pageQuery(query),
        employeeId: employee.id,
        status,
        from: period.from,
        to: period.to,
      },
    }),
    apiFetch<AttendanceSummaryDto>("/attendance/summary", {
      query: { employeeId: employee.id, from: period.from, to: period.to },
    }),
  ]);

  const records = recordPage.items;
  const windowLabel = dateRange(period.from, period.to);

  const canCreate = can(session.role, "attendance", "create");
  const canUpdate = can(session.role, "attendance", "update");
  const canDelete = can(session.role, "attendance", "delete");

  // The route already says who this is, so the employee select comes off the
  // form and the id is bound into the action instead.
  const createFields = withoutField(attendanceFields(), "employeeId");
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
                        description: `The punches for ${employee.fullName} on ${formatDate(row.checkIn)} are removed, along with the hours payroll reads from them. This cannot be undone.`,
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
          // The API calls an empty window 100% healthy, which on a narrow
          // period reads as a perfect week rather than as no data at all.
          value={summary.totalRecords > 0 ? percent(summary.healthPercent) : "—"}
          hint={`${summary.totalRecords} records · ${period.label}`}
          tone={
            summary.totalRecords > 0 && summary.healthPercent < 80
              ? "danger"
              : "neutral"
          }
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
        selects={[
          {
            key: "period",
            // Clearing the key is what "this month" means, so the placeholder
            // entry is the default rather than an absence of one.
            placeholder: "This month",
            options: PERIOD_OPTIONS,
            width: "w-40",
          },
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
        count={{ total: recordPage.total, noun: "record" }}
        actions={
          canCreate ? (
            <RecordDialog
              title="Record attendance"
              description={`For a shift the clock missed. This is filed against ${employee.fullName}. Leave the check-out blank if the shift is still running.`}
              fields={createFields}
              action={saveAttendanceFor.bind(null, employee.id)}
              submitLabel="Record attendance"
            />
          ) : null
        }
      />

      {records.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={
            status ? "Nothing matches in this period" : "No attendance in this period"
          }
          // Naming the window matters: an empty list is otherwise read as "this
          // employee has no attendance at all" rather than "none in July".
          description={
            status
              ? `No record for ${employee.fullName} between ${windowLabel} matches these filters. Try a wider period, or clear a filter.`
              : `Nothing was punched for ${employee.fullName} between ${windowLabel}. Pick a wider period to look further back.`
          }
        />
      ) : (
        <>
          <DataTable
            rows={records}
            getKey={(row) => row.id}
            columns={[
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
                cell: (row) => (
                  <span className="tabular-nums">{formatTime(row.checkIn)}</span>
                ),
              },
              {
                header: "Out",
                cell: (row) => (
                  <span className="tabular-nums">
                    {formatTime(row.checkOut)}
                  </span>
                ),
              },
              {
                header: "Worked",
                align: "right",
                hideBelow: "sm",
                cell: (row) => (
                  <span className="tabular-nums">{hours(row.workedHours)}</span>
                ),
              },
              {
                header: "Overtime",
                align: "right",
                hideBelow: "md",
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
                      <Badge
                        variant="outline"
                        title={row.editReason ?? undefined}
                      >
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
          <Pagination meta={recordPage} noun="record" />
        </>
      )}
    </>
  );
}
