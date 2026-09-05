import type { Metadata } from "next";
import { CalendarOff, Wallet } from "lucide-react";
import {
  ALLOCATION_STATUSES,
  LEAVE_REQUEST_STATUSES,
  can,
  type LeaveAllocationDto,
  type LeaveRequestDto,
  type Paginated,
  type TimeOffTypeDto,
} from "@peoplepay360/shared";

import {
  LeaveBalances,
  loadBalances,
} from "@/app/(app)/time-off/_components/leave-balances";
import {
  AllocationList,
  RequestList,
} from "@/app/(app)/time-off/_components/time-off-lists";
import {
  NEW_ALLOCATION,
  allocationFields,
  requestFields,
} from "@/app/(app)/time-off/fields";
import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { EmptyState, Section } from "@/components/data/primitives";
import { RecordDialog } from "@/components/form";
import { ApiError, apiFetch } from "@/lib/api-client";
import { withoutField } from "@/lib/fields";
import { ALL_ROWS, emptyPage } from "@/lib/paged";
import { statusOptions } from "@/lib/status";

import { saveAllocationFor, saveRequestFor } from "../actions";
import { requireEmployeeTab } from "../_lib";

export const metadata: Metadata = { title: "Time off" };

type SearchParams = Promise<{
  status?: string;
  allocStatus?: string;
  reqPage?: string;
  reqPageSize?: string;
  allocPage?: string;
  allocPageSize?: string;
}>;

/**
 * A role that turns out not to be allowed one of these lists gets the tab
 * without it rather than an error, matching how the module screen behaves.
 */
async function soft<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return fallback;
    throw error;
  }
}

/**
 * One employee's leave: what they have left, what they have asked for, and
 * what they have been granted. Filing and approving both happen here, so a
 * decision can be made against the balance shown directly above it.
 *
 * Two lists share the screen, so each pages under its own URL keys — moving
 * through requests must not move the allocations underneath them.
 */
export default async function EmployeeTimeOffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { session, employee } = await requireEmployeeTab(id, "timeOffRequests");
  const query = await searchParams;

  const status = LEAVE_REQUEST_STATUSES.some((value) => value === query.status)
    ? query.status
    : undefined;
  const allocStatus = ALLOCATION_STATUSES.some(
    (value) => value === query.allocStatus,
  )
    ? query.allocStatus
    : undefined;

  const canReadAllocations = can(session.role, "timeOffAllocations", "read");

  const [requestPage, allocationPage, typePage, balances] = await Promise.all([
    apiFetch<Paginated<LeaveRequestDto>>("/time-off/requests", {
      query: {
        ...pageQuery(query, "req"),
        employeeId: employee.id,
        status,
      },
    }),
    canReadAllocations
      ? soft(
          apiFetch<Paginated<LeaveAllocationDto>>("/time-off/allocations", {
            query: {
              ...pageQuery(query, "alloc"),
              employeeId: employee.id,
              status: allocStatus,
            },
          }),
          emptyPage<LeaveAllocationDto>(),
        )
      : emptyPage<LeaveAllocationDto>(),
    // The whole list rather than a page of it: these fill the type selects,
    // where a page would silently drop options.
    soft(
      apiFetch<Paginated<TimeOffTypeDto>>("/time-off/types", {
        query: { pageSize: ALL_ROWS },
      }),
      emptyPage<TimeOffTypeDto>(),
    ),
    canReadAllocations ? loadBalances(employee.id) : null,
  ]);

  const requests = requestPage.items;
  const allocations = allocationPage.items;

  // An archived type stays out of new records. A record already pointing at
  // one keeps it, because the form posts the id it was given either way.
  const types = typePage.items;
  const activeTypes = types
    .filter((type) => type.active)
    .map((type) => ({ value: type.id, label: type.name }));
  const typeOptions = types.map((type) => ({
    value: type.id,
    label: type.name,
  }));

  // The route names the employee, so neither form asks who this is for.
  const requestForm = withoutField(
    requestFields({ timeOffTypes: activeTypes }),
    "employeeId",
  );
  const allocationForm = withoutField(
    allocationFields({ timeOffTypes: activeTypes }),
    "employeeId",
  );

  const canCreateRequest = can(session.role, "timeOffRequests", "create");
  const canEditRequest = can(session.role, "timeOffRequests", "update");
  const canDeleteRequest = can(session.role, "timeOffRequests", "delete");
  const canApproveRequest = can(session.role, "timeOffRequests", "approve");

  const canCreateAllocation = can(session.role, "timeOffAllocations", "create");
  const canEditAllocation = can(session.role, "timeOffAllocations", "update");
  const canDeleteAllocation = can(session.role, "timeOffAllocations", "delete");
  const canApproveAllocation = can(
    session.role,
    "timeOffAllocations",
    "approve",
  );

  return (
    <>
      {balances ? (
        <LeaveBalances
          rows={balances}
          description={`Where ${employee.fullName} stands today: approved allocations less approved leave.`}
        />
      ) : null}

      <Section
        title="Requests"
        description={`Leave ${employee.fullName} has filed, and where each one has got to.`}
      >
        <div className="flex flex-col gap-4">
          <FilterBar
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
            count={{ total: requestPage.total, noun: "request" }}
            actions={
              canCreateRequest ? (
                <RecordDialog
                  title="New request"
                  description={`Filed for ${employee.fullName}. The duration comes from their working schedule, and a type that draws from an allocation is checked against the balance above.`}
                  fields={requestForm}
                  action={saveRequestFor.bind(null, employee.id)}
                  submitLabel="File request"
                />
              ) : null
            }
          />

          {requests.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title={status ? "No requests match" : "No requests yet"}
              description={
                status
                  ? "Clear the filter to see the rest of this employee's leave."
                  : `Leave filed for ${employee.fullName} appears here with its dates, duration and where it has got to.`
              }
            />
          ) : (
            <>
              <RequestList
                rows={requests}
                fields={requestForm}
                canEdit={canEditRequest}
                canDelete={canDeleteRequest}
                canApprove={canApproveRequest}
                viewerEmployeeId={session.employeeId}
                hideEmployee
              />
              <Pagination meta={requestPage} noun="request" param="req" />
            </>
          )}
        </div>
      </Section>

      {canReadAllocations ? (
        <Section
          title="Allocations"
          description="The balances this employee can draw leave from. An allocation has to be approved before any request consumes it."
        >
          <div className="flex flex-col gap-4">
            <FilterBar
              selects={[
                {
                  key: "allocStatus",
                  placeholder: "Any status",
                  options: statusOptions(ALLOCATION_STATUSES),
                  width: "w-40",
                },
              ]}
              count={{ total: allocationPage.total, noun: "allocation" }}
              actions={
                canCreateAllocation ? (
                  <RecordDialog
                    title="New allocation"
                    description={`Grants ${employee.fullName} a balance to draw from. It has to be approved before any request consumes it.`}
                    fields={allocationForm}
                    action={saveAllocationFor.bind(null, employee.id)}
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
                  allocStatus ? "No allocations match" : "No allocations yet"
                }
                description={
                  allocStatus
                    ? "Clear the filter to see the rest."
                    : `A type that needs an allocation cannot be requested until ${employee.fullName} has been granted one.`
                }
              />
            ) : (
              <>
                <AllocationList
                  rows={allocations}
                  fields={allocationForm}
                  canEdit={canEditAllocation}
                  canDelete={canDeleteAllocation}
                  canApprove={canApproveAllocation}
                  hideEmployee
                />
                <Pagination
                  meta={allocationPage}
                  noun="allocation"
                  param="alloc"
                />
              </>
            )}
          </div>
        </Section>
      ) : null}
    </>
  );
}
