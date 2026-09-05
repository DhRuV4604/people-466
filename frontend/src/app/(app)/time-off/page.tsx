import type { Metadata } from "next";
import { CalendarOff, Tags, Wallet } from "lucide-react";
import {
  ALLOCATION_STATUSES,
  LEAVE_REQUEST_STATUSES,
  LEAVE_UNITS,
  can,
  scopeToOwnRecords,
  type LeaveAllocationDto,
  type LeaveRequestDto,
  type TimeOffTypeDto,
} from "@peoplepay360/shared";

import { FilterBar } from "@/components/data/filter-bar";
import { EmptyState, StatGrid, StatTile } from "@/components/data/primitives";
import { RecordDialog } from "@/components/form";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { loadRefs } from "@/lib/refs";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import { LeaveBalances, loadBalances } from "./_components/leave-balances";
import {
  AllocationList,
  RequestList,
  TypeList,
} from "./_components/time-off-lists";
import { saveAllocation, saveRequest, saveTimeOffType } from "./actions";
import {
  NEW_ALLOCATION,
  NEW_TYPE,
  allocationFields,
  requestFields,
  timeOffTypeFields,
} from "./fields";

export const metadata: Metadata = {
  title: "Time off",
  description: "Requests, allocations and the types they draw from.",
};

type SearchParams = Promise<{
  tab?: string;
  q?: string;
  status?: string;
  typeId?: string;
  allocStatus?: string;
  allocType?: string;
  allocEmployee?: string;
  typeUnit?: string;
  typeActive?: string;
}>;

/**
 * The API is the enforcement point, so a list this role turns out not to be
 * allowed to read becomes an empty tab rather than taking the page down.
 */
async function soft<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return fallback;
    throw error;
  }
}

export default async function TimeOffPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("timeOffRequests");

  const params = await searchParams;

  const [requests, allocations, types, refs, balances] = await Promise.all([
    apiFetch<LeaveRequestDto[]>("/time-off/requests", {
      query: { q: params.q, status: params.status, typeId: params.typeId, limit: 200 },
    }),
    soft(
      apiFetch<LeaveAllocationDto[]>("/time-off/allocations", {
        query: {
          employeeId: params.allocEmployee,
          typeId: params.allocType,
          status: params.allocStatus,
        },
      }),
      [],
    ),
    soft(apiFetch<TimeOffTypeDto[]>("/time-off/types"), []),
    loadRefs(["employees"]),
    // Only an account tied to an employee record has a balance of its own; an
    // admin who is not on the payroll has nothing to show.
    session.employeeId ? loadBalances(session.employeeId) : null,
  ]);

  const toOption = (type: TimeOffTypeDto) => ({
    value: type.id,
    label: type.name,
  });

  const typeOptions = types.map(toOption);

  // An archived type stays out of new records. A record already pointing at
  // one keeps it, because the form posts the id it was given either way.
  const formRefs = {
    employees: refs.employees,
    timeOffTypes: types.filter((type) => type.active).map(toOption),
  };

  // An employee files only against their own record, so the employee field is
  // fixed to them rather than offering a list they cannot usefully pick from.
  const self =
    scopeToOwnRecords(session.role) && session.employeeId
      ? { id: session.employeeId, label: session.name }
      : null;

  const requestForm = requestFields(formRefs, self);
  const allocationForm = allocationFields(formRefs, self);
  const typeForm = timeOffTypeFields();

  const canCreateRequest = can(session.role, "timeOffRequests", "create");
  const canEditRequest = can(session.role, "timeOffRequests", "update");
  const canDeleteRequest = can(session.role, "timeOffRequests", "delete");
  const canApproveRequest = can(session.role, "timeOffRequests", "approve");

  const canReadAllocations = can(session.role, "timeOffAllocations", "read");
  const canCreateAllocation = can(session.role, "timeOffAllocations", "create");
  const canEditAllocation = can(session.role, "timeOffAllocations", "update");
  const canDeleteAllocation = can(session.role, "timeOffAllocations", "delete");
  const canApproveAllocation = can(session.role, "timeOffAllocations", "approve");

  const canReadTypes = can(session.role, "timeOffTypes", "read");
  const canCreateType = can(session.role, "timeOffTypes", "create");
  const canEditType = can(session.role, "timeOffTypes", "update");
  const canDeleteType = can(session.role, "timeOffTypes", "delete");

  // The types list is small enough to arrive whole, so its filters are applied
  // here rather than being query parameters the API does not offer.
  const shownTypes = types.filter(
    (type) =>
      (params.typeActive !== "true" || type.active) &&
      (!params.typeUnit || type.unit === params.typeUnit),
  );

  const requestFilters = Boolean(params.q || params.status || params.typeId);
  const allocationFilters = Boolean(
    params.allocStatus || params.allocType || params.allocEmployee,
  );
  const typeFilters = Boolean(params.typeUnit || params.typeActive);

  const pending = requests.filter((row) => row.status === "TO_APPROVE").length;

  // Hour-counted leave is left out rather than added to a day count, and the
  // total is rounded because summing two-decimal durations drifts in binary.
  const approvedDays =
    Math.round(
      requests
        .filter((row) => row.status === "APPROVED" && row.type.unit === "DAY")
        .reduce((sum, row) => sum + row.duration, 0) * 100,
    ) / 100;

  // Which tab a link opens on. Switching afterwards is the tab's own state, so
  // filtering inside a tab never has to put it back.
  const tab =
    params.tab === "allocations" && canReadAllocations
      ? "allocations"
      : params.tab === "types" && canReadTypes
        ? "types"
        : "requests";

  return (
    <>
      <StatGrid>
        <StatTile
          label="Waiting on approval"
          value={pending}
          hint={pending === 0 ? "Nothing pending" : "Needs a decision"}
          tone={pending > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label="Approved days"
          value={approvedDays}
          hint="Day-counted leave in the requests shown"
        />
        <StatTile
          label="Allocations"
          value={allocations.length}
          hint={`${allocations.filter((row) => row.status === "DRAFT").length} still draft`}
        />
        <StatTile
          label="Types"
          value={types.filter((type) => type.active).length}
          hint={`${types.length} defined`}
        />
      </StatGrid>

      {balances ? (
        <LeaveBalances
          rows={balances}
          title="Your balances"
          description="What you have left to take, as things stand today."
        />
      ) : null}

      <Tabs defaultValue={tab} className="w-full">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          {canReadAllocations ? (
            <TabsTrigger value="allocations">Allocations</TabsTrigger>
          ) : null}
          {canReadTypes ? <TabsTrigger value="types">Types</TabsTrigger> : null}
        </TabsList>

        <TabsContents className="mt-4">
          <TabsContent value="requests" className="flex flex-col gap-6">
            <FilterBar
              search={{ placeholder: "Search employee" }}
              selects={[
                {
                  key: "status",
                  placeholder: "Any status",
                  options: statusOptions(LEAVE_REQUEST_STATUSES),
                  width: "w-44",
                },
                {
                  key: "typeId",
                  placeholder: "Any type",
                  options: typeOptions,
                  width: "w-44",
                },
              ]}
              quickFilters={[
                { key: "status", value: "TO_APPROVE", label: "To approve" },
                { key: "status", value: "APPROVED", label: "Approved" },
              ]}
              count={{ total: requests.length, noun: "request" }}
              actions={
                canCreateRequest ? (
                  <RecordDialog
                    title="New request"
                    description="The duration comes from the employee's working schedule, and a type that draws from an allocation is checked against the balance."
                    fields={requestForm}
                    action={saveRequest}
                    submitLabel="File request"
                  />
                ) : null
              }
            />

            {requests.length === 0 ? (
              <EmptyState
                icon={CalendarOff}
                title={
                  requestFilters ? "No requests match" : "No requests yet"
                }
                description={
                  requestFilters
                    ? "Try a broader search, or clear a filter to widen the results."
                    : "Filed leave appears here with its dates, duration and where it has got to."
                }
              />
            ) : (
              <RequestList
                rows={requests}
                fields={requestForm}
                canEdit={canEditRequest}
                canDelete={canDeleteRequest}
                canApprove={canApproveRequest}
                viewerEmployeeId={session.employeeId}
              />
            )}
          </TabsContent>

          {canReadAllocations ? (
            <TabsContent value="allocations" className="flex flex-col gap-6">
              <FilterBar
                selects={[
                  // An employee's allocations are already only their own, so a
                  // picker of other people would filter nothing.
                  ...(self
                    ? []
                    : [
                        {
                          key: "allocEmployee",
                          placeholder: "Anyone",
                          options: refs.employees,
                          width: "w-56",
                        },
                      ]),
                  {
                    key: "allocType",
                    placeholder: "Any type",
                    options: typeOptions,
                    width: "w-44",
                  },
                  {
                    key: "allocStatus",
                    placeholder: "Any status",
                    options: statusOptions(ALLOCATION_STATUSES),
                    width: "w-40",
                  },
                ]}
                quickFilters={[
                  { key: "allocStatus", value: "DRAFT", label: "Draft" },
                  { key: "allocStatus", value: "APPROVED", label: "Approved" },
                ]}
                count={{ total: allocations.length, noun: "allocation" }}
                actions={
                  canCreateAllocation ? (
                    <RecordDialog
                      title="New allocation"
                      description="Grants a balance the employee can draw from. It has to be approved before any request consumes it."
                      fields={allocationForm}
                      action={saveAllocation}
                      record={NEW_ALLOCATION}
                      submitLabel="Grant allocation"
                    />
                  ) : null
                }
              />

              {allocations.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title={
                    allocationFilters
                      ? "No allocations match"
                      : "No allocations yet"
                  }
                  description={
                    allocationFilters
                      ? "Clear a filter to widen the results."
                      : "A type that needs an allocation cannot be requested until someone has been granted one."
                  }
                />
              ) : (
                <AllocationList
                  rows={allocations}
                  fields={allocationForm}
                  canEdit={canEditAllocation}
                  canDelete={canDeleteAllocation}
                  canApprove={canApproveAllocation}
                />
              )}
            </TabsContent>
          ) : null}

          {canReadTypes ? (
            <TabsContent value="types" className="flex flex-col gap-6">
              <FilterBar
                selects={[
                  {
                    key: "typeUnit",
                    placeholder: "Any unit",
                    options: statusOptions(LEAVE_UNITS),
                    width: "w-40",
                  },
                ]}
                quickFilters={[
                  { key: "typeActive", value: "true", label: "Active only" },
                ]}
                count={{ total: shownTypes.length, noun: "type" }}
                actions={
                  canCreateType ? (
                    <RecordDialog
                      title="New type"
                      description="A type decides how leave is counted, whether it needs an allocation or an approver, and whether it is paid."
                      fields={typeForm}
                      action={saveTimeOffType}
                      record={NEW_TYPE}
                      submitLabel="Create type"
                    />
                  ) : null
                }
              />

              {shownTypes.length === 0 ? (
                <EmptyState
                  icon={Tags}
                  title={typeFilters ? "No types match" : "No types yet"}
                  description={
                    typeFilters
                      ? "Clear a filter to widen the results."
                      : "Nothing can be requested until at least one type exists."
                  }
                />
              ) : (
                <TypeList
                  rows={shownTypes}
                  fields={typeForm}
                  canEdit={canEditType}
                  canDelete={canDeleteType}
                />
              )}
            </TabsContent>
          ) : null}
        </TabsContents>
      </Tabs>
    </>
  );
}
