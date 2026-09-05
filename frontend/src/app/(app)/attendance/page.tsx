import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, LogIn, LogOut } from "lucide-react";
import {
  ATTENDANCE_STATUSES,
  can,
  scopeToOwnRecords,
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
import {
  dateRange,
  formatDate,
  formatTime,
  hours,
  percent,
} from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import { attendanceEditFields, attendanceFields } from "./fields";
import { PERIOD_OPTIONS, attendancePeriod } from "./period";
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

/**
 * The API will hand over up to 1000 rows, but a table that long is slow to
 * render and nobody reads to the end of it. A window holding more than this
 * says so under the filters rather than truncating in silence.
 */
const LIMIT = 200;

type Filters = {
  q?: string;
  status?: string;
  period?: string;
  employee?: string;
};

type SearchParams = Promise<Filters>;

/** The id shape the API validates a filter against. Anything else is a 400. */
const ENTITY_ID = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The URL a hand-written filter should have had, or null when it already is
 * that one. A status or an employee id the API does not recognise comes back
 * as a 400 and takes the whole screen down; an unrecognised period is ignored,
 * leaving a chip naming a window the list is not showing. Dropping the key
 * answers both, and rewriting the URL keeps a link honest about what it opens.
 */
function canonicalUrl(params: Filters, canPickEmployee: boolean): string | null {
  const period = PERIOD_OPTIONS.some((option) => option.value === params.period)
    ? params.period
    : undefined;
  const status = ATTENDANCE_STATUSES.some((value) => value === params.status)
    ? params.status
    : undefined;
  const employee =
    canPickEmployee && ENTITY_ID.test(params.employee ?? "")
      ? params.employee
      : undefined;

  const dropped =
    (params.period !== undefined && period === undefined) ||
    (params.status !== undefined && status === undefined) ||
    (params.employee !== undefined && employee === undefined);
  if (!dropped) return null;

  const kept = new URLSearchParams();
  for (const [key, value] of Object.entries({
    q: params.q,
    period,
    employee,
    status,
  })) {
    if (value) kept.set(key, value);
  }

  const query = kept.toString();
  return query ? `/attendance?${query}` : "/attendance";
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("attendance");

  const params = await searchParams;

  // An employee's list is already scoped to their own records, so a picker of
  // other people would be noise. The value is dropped for that role rather
  // than forwarded, so a hand-written URL cannot widen what they see either.
  const canPickEmployee = !scopeToOwnRecords(session.role);

  const canonical = canonicalUrl(params, canPickEmployee);
  if (canonical) redirect(canonical);

  const period = attendancePeriod(params.period);
  const employeeId = canPickEmployee ? params.employee : undefined;

  // The summary takes the same window and employee, so the tiles describe the
  // rows underneath them rather than some other slice of the year.
  const [fetched, summary, refs] = await Promise.all([
    apiFetch<AttendanceDto[]>("/attendance", {
      query: {
        q: params.q,
        status: params.status,
        employeeId,
        from: period.from,
        to: period.to,
        limit: LIMIT + 1,
      },
    }),
    apiFetch<AttendanceSummaryDto>("/attendance/summary", {
      query: { employeeId, from: period.from, to: period.to },
    }),
    loadRefs(["employees"]),
  ]);

  // The row past the cap is asked for and never shown: its presence is what
  // says rows were left off the end. Reading that from the summary instead
  // would misfire, because the summary cannot see the status or search filter.
  const truncated = fetched.length > LIMIT;
  const records = truncated ? fetched.slice(0, LIMIT) : fetched;

  const windowLabel = dateRange(period.from, period.to);
  const hasFilters = Boolean(params.q || params.status || employeeId);

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
        search={{ placeholder: "Search employee" }}
        selects={[
          {
            key: "period",
            // Clearing the key is what "this month" means, so the placeholder
            // entry is the default rather than an absence of one.
            placeholder: "This month",
            options: PERIOD_OPTIONS,
            width: "w-40",
          },
          ...(canPickEmployee
            ? [
                {
                  key: "employee",
                  placeholder: "All employees",
                  options: refs.employees,
                  width: "w-56",
                },
              ]
            : []),
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

      {truncated ? (
        <p className="text-xs text-muted-foreground">
          Showing the most recent {LIMIT} records of {windowLabel}. Narrow the
          period{canPickEmployee ? ", or pick an employee," : ""} to see the
          rest.
        </p>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={
            hasFilters
              ? "Nothing matches in this period"
              : "No attendance in this period"
          }
          // Naming the window matters: an empty list is otherwise read as "this
          // employee has no attendance at all" rather than "none in July".
          description={
            hasFilters
              ? `No record between ${windowLabel} matches these filters. Try a wider period, or clear a filter.`
              : `Nothing was punched between ${windowLabel}. Pick a wider period to look further back.`
          }
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
