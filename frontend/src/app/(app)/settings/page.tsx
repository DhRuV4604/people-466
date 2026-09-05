import type { Metadata } from "next";
import { DEFAULT_APP_SETTINGS, ROLE_LABELS, can } from "@peoplepay360/shared";
import type {
  AppSettingsDto,
  DepartmentDto,
  JobPositionDto,
  Role,
  WorkingScheduleDto,
  Paginated,
} from "@peoplepay360/shared";
import { Pencil } from "lucide-react";

import { DataTable, type Column } from "@/components/data/data-table";
import { Fact, Section } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { RecordDialog, RowActions } from "@/components/form";
import {
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { hours, pluralise } from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { requireAccess } from "@/lib/access";
import { emptyPage } from "@/lib/paged";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";

import { EditScheduleButton } from "./_components/edit-schedule-button";
import { ScheduleLinesField } from "./_components/schedule-lines-field";
import {
  deleteDepartment,
  deletePosition,
  deleteSchedule,
  saveAttendancePolicy,
  saveDepartment,
  savePosition,
  saveSchedule,
} from "./actions";
import {
  attendancePolicyFields,
  departmentFields,
  positionFields,
  scheduleFields,
} from "./fields";

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Departments, positions, schedules and the attendance policy.",
};

type SearchParams = Promise<Record<string, string | undefined>>;

/** Not every role may read every list here, so each call fails soft. */
async function soft<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return fallback;
    throw error;
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("workingSchedules");
  const params = await searchParams;

  // Four independent tables on one screen, so each carries its own page in the
  // URL and paging one leaves the others where they were.
  const [deptPage, posPage, schedulePage, policy, refs] =
    await Promise.all([
      soft(
        apiFetch<Paginated<DepartmentDto>>("/departments", {
          query: pageQuery(params, "dept"),
        }),
        emptyPage<DepartmentDto>(),
      ),
      soft(
        apiFetch<Paginated<JobPositionDto>>("/job-positions", {
          query: pageQuery(params, "pos"),
        }),
        emptyPage<JobPositionDto>(),
      ),
      soft(
        apiFetch<Paginated<WorkingScheduleDto>>("/working-schedules", {
          query: pageQuery(params, "sched"),
        }),
        emptyPage<WorkingScheduleDto>(),
      ),
      // The API answers with the defaults when the row has never been saved,
      // so the tab shows the rule actually in force either way.
      soft(apiFetch<AppSettingsDto>("/app-settings"), {
        ...DEFAULT_APP_SETTINGS,
      }),
      loadRefs(["employees"]),
    ]);

  const departments = deptPage.items;
  const positions = posPage.items;
  const schedules = schedulePage.items;

  // Departments and positions are employee reference data: the API guards
  // those routes with the employees module, not the one this page sits behind.
  const canCreateReference = can(session.role, "employees", "create");
  const canUpdateReference = can(session.role, "employees", "update");
  const canDeleteReference = can(session.role, "employees", "delete");
  const canManageReference = canUpdateReference || canDeleteReference;

  const canCreateSchedule = can(session.role, "workingSchedules", "create");
  const canUpdateSchedule = can(session.role, "workingSchedules", "update");
  const canDeleteSchedule = can(session.role, "workingSchedules", "delete");
  const canManageSchedule = canUpdateSchedule || canDeleteSchedule;

  // Attendance policy is guarded by the same permission as schedules: both
  // decide how work is counted, so the roles that may change one may change
  // the other.
  const canUpdatePolicy = canUpdateSchedule;


  const departmentActions: Column<DepartmentDto>[] = canManageReference
    ? [
        {
          align: "right",
          className: "w-10",
          cell: (row) => (
            <RowActions
              edit={
                canUpdateReference
                  ? {
                      title: "Edit department",
                      fields: departmentFields(),
                      action: saveDepartment,
                      record: { ...row },
                    }
                  : undefined
              }
              remove={
                canDeleteReference
                  ? {
                      action: deleteDepartment.bind(null, row.id),
                      title: `Delete ${row.name}?`,
                      description:
                        "A department that still has employees in it cannot be removed. This cannot be undone.",
                    }
                  : undefined
              }
            />
          ),
        },
      ]
    : [];

  const positionActions: Column<JobPositionDto>[] = canManageReference
    ? [
        {
          align: "right",
          className: "w-10",
          cell: (row) => (
            <RowActions
              edit={
                canUpdateReference
                  ? {
                      title: "Edit position",
                      fields: positionFields(),
                      action: savePosition,
                      record: { ...row },
                    }
                  : undefined
              }
              remove={
                canDeleteReference
                  ? {
                      action: deletePosition.bind(null, row.id),
                      title: `Delete ${row.name}?`,
                      description:
                        "A position an employee still holds cannot be removed. This cannot be undone.",
                    }
                  : undefined
              }
            />
          ),
        },
      ]
    : [];

  const scheduleActions: Column<WorkingScheduleDto>[] = canManageSchedule
    ? [
        {
          align: "right",
          className: "w-20",
          // The week control cannot ride in the row menu, so the edit is its
          // own button beside a menu that keeps only delete.
          cell: (row) => (
            <div className="flex items-center justify-end gap-1">
              {canUpdateSchedule ? <EditScheduleButton schedule={row} /> : null}
              {canDeleteSchedule ? (
                <RowActions
                  remove={{
                    action: deleteSchedule.bind(null, row.id),
                    title: `Delete ${row.name}?`,
                    description:
                      "A schedule an employee or a contract still uses cannot be removed. This cannot be undone.",
                  }}
                />
              ) : null}
            </div>
          ),
        },
      ]
    : [];

  // Which tab a link opens on. Switching afterwards is the tab's own state.
  // "Users" is the one tab a role may not be allowed to see at all, so a link
  // pointing at it falls back rather than opening an empty panel.
  const tab =
    params.tab === "positions"
      ? "positions"
      : params.tab === "schedules"
        ? "schedules"
        : params.tab === "attendance"
          ? "attendance"
          : "departments";

  return (
    <Tabs defaultValue={tab} className="w-full">
      <TabsList>
        <TabsTrigger value="departments">Departments</TabsTrigger>
        <TabsTrigger value="positions">Job positions</TabsTrigger>
        <TabsTrigger value="schedules">Schedules</TabsTrigger>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
      </TabsList>

      <TabsContents className="mt-4">
        <TabsContent value="departments">
          <Section
            title="Departments"
            description="Used to group employees and to scope a pay run."
            action={
              canCreateReference ? (
                <RecordDialog
                  title="New department"
                  description="A code is optional, and stands in for the name wherever space is tight."
                  fields={departmentFields()}
                  action={saveDepartment}
                  submitLabel="Create department"
                />
              ) : null
            }
          >
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No departments defined.
              </p>
            ) : (
              <DataTable
                rows={departments}
                getKey={(row) => row.id}
                columns={[
                  { header: "Name", cell: (row) => row.name },
                  {
                    header: "Code",
                    cell: (row) => (
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.code ?? "—"}
                      </span>
                    ),
                  },
                  {
                    header: "People",
                    align: "right",
                    cell: (row) => (
                      <span className="tabular-nums">
                        {row.employeeCount ?? 0}
                      </span>
                    ),
                  },
                  ...departmentActions,
                ]}
              />
            )}
            <Pagination meta={deptPage} noun="department" param="dept" />
          </Section>
        </TabsContent>

        <TabsContent value="positions">
          <Section
            title="Job positions"
            description="What an employee does, shown on contracts and payslips."
            action={
              canCreateReference ? (
                <RecordDialog
                  title="New position"
                  description="The title as it should read on a contract or a payslip."
                  fields={positionFields()}
                  action={savePosition}
                  submitLabel="Create position"
                />
              ) : null
            }
          >
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No positions defined.
              </p>
            ) : (
              <DataTable
                rows={positions}
                getKey={(row) => row.id}
                columns={[
                  { header: "Name", cell: (row) => row.name },
                  {
                    header: "People",
                    align: "right",
                    cell: (row) => (
                      <span className="tabular-nums">
                        {row.employeeCount ?? 0}
                      </span>
                    ),
                  },
                  ...positionActions,
                ]}
              />
            )}
            <Pagination meta={posPage} noun="position" param="pos" />
          </Section>
        </TabsContent>

        <TabsContent value="schedules">
          <Section
            title="Working schedules"
            description="Weekly hours come from the schedule lines, and payroll uses them to work out a day rate."
            action={
              canCreateSchedule ? (
                <RecordDialog
                  title="New schedule"
                  description="Weekly hours are worked out from the days below, so there is nothing to total up by hand."
                  fields={scheduleFields()}
                  action={saveSchedule}
                  submitLabel="Create schedule"
                  // No id, so this stays a create; the values are only where the
                  // form starts.
                  record={{
                    scheduleType: "FULL_TIME",
                    timezone: "UTC",
                    active: true,
                  }}
                  extras={<ScheduleLinesField />}
                />
              ) : null
            }
          >
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No schedules defined.
              </p>
            ) : (
              <DataTable
                rows={schedules}
                getKey={(row) => row.id}
                columns={[
                  {
                    header: "Schedule",
                    className: "min-w-[180px]",
                    cell: (row) => (
                      <>
                        <span className="block font-medium">{row.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {row.lines.length} working days
                        </span>
                      </>
                    ),
                  },
                  {
                    header: "Type",
                    cell: (row) => <StatusBadge value={row.scheduleType} />,
                  },
                  {
                    header: "Per week",
                    align: "right",
                    cell: (row) => (
                      <span className="tabular-nums">
                        {hours(row.hoursPerWeek)}
                      </span>
                    ),
                  },
                  {
                    header: "Timezone",
                    hideBelow: "md",
                    cell: (row) => (
                      <span className="text-muted-foreground">
                        {row.timezone}
                      </span>
                    ),
                  },
                  {
                    header: "In use",
                    align: "right",
                    hideBelow: "sm",
                    cell: (row) => (
                      <span className="tabular-nums text-muted-foreground">
                        {row.employeeCount ?? 0} people ·{" "}
                        {row.contractCount ?? 0} contracts
                      </span>
                    ),
                  },
                  {
                    header: "",
                    align: "right",
                    cell: (row) =>
                      row.active ? null : (
                        <Badge variant="outline">Inactive</Badge>
                      ),
                  },
                  ...scheduleActions,
                ]}
              />
            )}
            <Pagination meta={schedulePage} noun="schedule" param="sched" />
          </Section>
        </TabsContent>

        <TabsContent value="attendance">
          <Section
            title="Attendance policy"
            description="How many times someone may check in during a single day. The API counts the day's punches against this before it opens another one."
            action={
              canUpdatePolicy ? (
                <RecordDialog
                  title="Attendance policy"
                  description="Applies to everyone checking in from the self-service space."
                  fields={attendancePolicyFields()}
                  action={saveAttendancePolicy}
                  record={{ ...policy }}
                  submitLabel="Save policy"
                  trigger={
                    <Button variant="outline" startIcon={<Pencil />}>
                      Edit policy
                    </Button>
                  }
                />
              ) : null
            }
          >
            <dl className="grid gap-6 sm:grid-cols-2">
              <Fact label="Check-ins allowed per day">
                {pluralise(policy.maxCheckInsPerDay, "check-in")}
              </Fact>
              <Fact label="Warn before checking out">
                {policy.warnOnCheckOut ? "Yes" : "No"}
              </Fact>
            </dl>
          </Section>
        </TabsContent>

      </TabsContents>
    </Tabs>
  );
}
