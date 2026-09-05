import { Ban, Check, X } from "lucide-react";
import type {
  LeaveAllocationDto,
  LeaveRequestDto,
  TimeOffTypeDto,
} from "@peoplepay360/shared";

import { DataTable } from "@/components/data/data-table";
import { PersonCell } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { ActionButton, RecordDialog, RowActions } from "@/components/form";
import { Badge, Button } from "@/components/ui";
import type { FieldSpec } from "@/lib/fields";
import { dateRange, formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/status";

import {
  approveAllocation,
  approveRequest,
  cancelRequest,
  deleteAllocation,
  deleteRequest,
  deleteTimeOffType,
  refuseAllocation,
  refuseRequest,
  saveAllocation,
  saveRequest,
  saveTimeOffType,
} from "../actions";
import { refusalFields } from "../fields";

/** The coloured dot every list uses to identify a type at a glance. */
function TypeCell({ type }: { type: { name: string; colorHex: string } }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: type.colorHex }}
      />
      {type.name}
    </span>
  );
}

export function RequestList({
  rows,
  fields,
  canEdit,
  canDelete,
  canApprove,
  viewerEmployeeId,
  hideEmployee = false,
}: {
  rows: LeaveRequestDto[];
  fields: FieldSpec[];
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  /** The viewer's own employee record, when they have one. */
  viewerEmployeeId: string | null;
  /**
   * Drops the employee column. Set on a list already about one person, where
   * repeating their name down every row says nothing.
   */
  hideEmployee?: boolean;
}) {
  return (
    <DataTable
      rows={rows}
      getKey={(row) => row.id}
      columns={[
        ...(hideEmployee
          ? []
          : [
              {
                header: "Employee",
                className: "min-w-[180px]",
                cell: (row: LeaveRequestDto) => (
                  <PersonCell
                    name={row.employee?.fullName ?? "Unknown"}
                    meta={row.employee?.department}
                    href={`/employees/${row.employeeId}`}
                  />
                ),
              },
            ]),
        { header: "Type", cell: (row) => <TypeCell type={row.type} /> },
        {
          header: "Dates",
          hideBelow: "sm",
          cell: (row) => (
            <span className="whitespace-nowrap text-muted-foreground">
              {dateRange(row.dateFrom, row.dateTo)}
            </span>
          ),
        },
        {
          header: "Duration",
          align: "right",
          cell: (row) => (
            <span className="tabular-nums">
              {row.duration} {row.type.unit === "HOUR" ? "h" : "d"}
            </span>
          ),
        },
        {
          header: "Filed",
          align: "right",
          hideBelow: "lg",
          cell: (row) => (
            <span className="whitespace-nowrap text-muted-foreground">
              {formatDate(row.createdAt)}
            </span>
          ),
        },
        {
          header: "Status",
          align: "right",
          cell: (row) => <StatusBadge value={row.status} />,
        },
        {
          className: "w-px",
          align: "right",
          cell: (row) => {
            const pending = row.status === "TO_APPROVE";
            // The API lets anyone withdraw a request they filed themselves, so
            // cancel follows that rule rather than the approver's.
            const canCancel =
              (canApprove || row.employeeId === viewerEmployeeId) &&
              (pending || row.status === "APPROVED");

            return (
              <div className="flex items-center justify-end gap-1">
                {canApprove && pending ? (
                  <RecordDialog
                    title="Refuse request"
                    description="The employee keeps the balance, and sees the reason on the refused request."
                    fields={refusalFields()}
                    action={refuseRequest.bind(null, row.id)}
                    submitLabel="Refuse request"
                    trigger={
                      <Button variant="outline" size="sm" startIcon={<X />}>
                        Refuse
                      </Button>
                    }
                  />
                ) : null}

                {canCancel ? (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    startIcon={<Ban />}
                    action={cancelRequest.bind(null, row.id)}
                    pendingLabel="Cancelling"
                    confirm={{
                      title: "Cancel this request?",
                      description:
                        "The leave is withdrawn and the balance goes back. Nothing reopens a cancelled request, so it would have to be filed again.",
                      confirmLabel: "Cancel request",
                      destructive: true,
                    }}
                  >
                    Cancel
                  </ActionButton>
                ) : null}

                <RowActions
                  items={
                    canApprove && pending
                      ? [
                          {
                            label: "Approve",
                            icon: <Check />,
                            action: approveRequest.bind(null, row.id),
                          },
                        ]
                      : []
                  }
                  edit={
                    canEdit
                      ? {
                          title: "Edit request",
                          description:
                            "Changing the dates recalculates the duration from the working schedule.",
                          fields,
                          action: saveRequest,
                          record: { ...row },
                        }
                      : undefined
                  }
                  remove={
                    canDelete
                      ? {
                          action: deleteRequest.bind(null, row.id),
                          title: "Delete this request?",
                          description:
                            "It leaves the record entirely. To keep the history, refuse or cancel it instead.",
                        }
                      : undefined
                  }
                />
              </div>
            );
          },
        },
      ]}
    />
  );
}

export function AllocationList({
  rows,
  fields,
  canEdit,
  canDelete,
  canApprove,
  hideEmployee = false,
}: {
  rows: LeaveAllocationDto[];
  fields: FieldSpec[];
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  /** See `RequestList`. */
  hideEmployee?: boolean;
}) {
  return (
    <DataTable
      rows={rows}
      getKey={(row) => row.id}
      columns={[
        ...(hideEmployee
          ? []
          : [
              {
                header: "Employee",
                className: "min-w-[180px]",
                cell: (row: LeaveAllocationDto) => (
                  <PersonCell
                    name={row.employee?.fullName ?? "Unknown"}
                    meta={row.employee?.department}
                    href={`/employees/${row.employeeId}`}
                  />
                ),
              },
            ]),
        { header: "Type", cell: (row) => <TypeCell type={row.type} /> },
        {
          header: "Valid",
          hideBelow: "md",
          cell: (row) => (
            <span className="whitespace-nowrap text-muted-foreground">
              {dateRange(row.validFrom, row.validTo)}
            </span>
          ),
        },
        {
          header: "Granted",
          align: "right",
          cell: (row) => <span className="tabular-nums">{row.quantity}</span>,
        },
        {
          header: "Taken",
          align: "right",
          hideBelow: "sm",
          cell: (row) => (
            <span className="tabular-nums text-muted-foreground">
              {row.taken}
            </span>
          ),
        },
        {
          header: "Left",
          align: "right",
          cell: (row) => (
            <span className="tabular-nums font-medium">{row.remaining}</span>
          ),
        },
        {
          header: "Status",
          align: "right",
          cell: (row) => <StatusBadge value={row.status} />,
        },
        {
          className: "w-px",
          align: "right",
          cell: (row) => {
            // Approving is the restorative direction and the API accepts it
            // from any state, so it stays offered until it would change
            // nothing. Refusing is withheld once leave has been taken against
            // the allocation: the API applies no guard there and the balance
            // would go negative.
            const decisions = canApprove
              ? [
                  ...(row.status === "APPROVED"
                    ? []
                    : [
                        {
                          label: "Approve",
                          icon: <Check />,
                          action: approveAllocation.bind(null, row.id),
                        },
                      ]),
                  ...(row.status === "REFUSED" || row.taken > 0
                    ? []
                    : [
                        {
                          label: "Refuse",
                          icon: <X />,
                          action: refuseAllocation.bind(null, row.id),
                          destructive: true,
                        },
                      ]),
                ]
              : [];

            // The status field reaches REFUSED by another route, so it is
            // withheld on the same condition as the menu verb.
            const editFields =
              row.taken > 0
                ? fields.map((field) =>
                    field.name === "status"
                      ? {
                          ...field,
                          options: field.options?.filter(
                            (option) => option.value !== "REFUSED",
                          ),
                        }
                      : field,
                  )
                : fields;

            return (
              <RowActions
                items={decisions}
                edit={
                  canEdit
                    ? {
                        title: "Edit allocation",
                        description:
                          "The quantity cannot drop below what approved leave has already taken.",
                        fields: editFields,
                        action: saveAllocation,
                        record: { ...row },
                      }
                    : undefined
                }
                remove={
                  canDelete
                    ? {
                        action: deleteAllocation.bind(null, row.id),
                        title: "Delete this allocation?",
                        description:
                          "The balance it grants goes with it. One that approved leave has already drawn from cannot be deleted.",
                      }
                    : undefined
                }
              />
            );
          },
        },
      ]}
    />
  );
}

export function TypeList({
  rows,
  fields,
  canEdit,
  canDelete,
}: {
  rows: TimeOffTypeDto[];
  fields: FieldSpec[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <DataTable
      rows={rows}
      getKey={(row) => row.id}
      columns={[
        {
          header: "Name",
          className: "min-w-[180px]",
          cell: (row) => <TypeCell type={row} />,
        },
        {
          header: "Code",
          cell: (row) => (
            <span className="font-mono text-xs text-muted-foreground">
              {row.code}
            </span>
          ),
        },
        {
          header: "Counted in",
          hideBelow: "sm",
          cell: (row) => (
            <span className="text-muted-foreground">
              {statusLabel(row.unit)}
            </span>
          ),
        },
        {
          header: "Rules",
          hideBelow: "lg",
          cell: (row) => (
            <span className="flex flex-wrap gap-1.5">
              {row.requiresAllocation ? (
                <Badge variant="outline">Allocated</Badge>
              ) : null}
              {row.requiresApproval ? (
                <Badge variant="outline">Approved</Badge>
              ) : null}
              {!row.paid ? <Badge variant="outline">Unpaid</Badge> : null}
            </span>
          ),
        },
        {
          header: "Most per request",
          align: "right",
          hideBelow: "xl",
          cell: (row) => (
            <span className="tabular-nums text-muted-foreground">
              {row.maxDaysPerRequest ?? "—"}
            </span>
          ),
        },
        {
          header: "Requests",
          align: "right",
          hideBelow: "md",
          cell: (row) => (
            <span className="tabular-nums text-muted-foreground">
              {row.requestCount ?? 0}
            </span>
          ),
        },
        {
          header: "Status",
          align: "right",
          cell: (row) => (
            <StatusBadge value={row.active ? "ACTIVE" : "INACTIVE"} />
          ),
        },
        {
          className: "w-px",
          align: "right",
          cell: (row) => (
            <RowActions
              edit={
                canEdit
                  ? {
                      title: "Edit type",
                      fields,
                      action: saveTimeOffType,
                      record: { ...row },
                    }
                  : undefined
              }
              remove={
                canDelete
                  ? {
                      action: deleteTimeOffType.bind(
                        null,
                        row.id,
                        Boolean(row.requestCount),
                      ),
                      title: `Delete ${row.name}?`,
                      // The API archives a type requests point at, deletes one
                      // nothing points at, and refuses one held only by
                      // allocations, so each case is said plainly up front.
                      description: row.requestCount
                        ? "Requests already use this type, so it is archived rather than deleted and stops appearing on new ones."
                        : row.allocationCount
                          ? "Allocations still grant this type. They have to go first, or the delete is refused."
                          : "Nothing uses this type yet, so it goes for good.",
                    }
                  : undefined
              }
            />
          ),
        },
      ]}
    />
  );
}
