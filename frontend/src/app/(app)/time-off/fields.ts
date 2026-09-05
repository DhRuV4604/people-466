import { ALLOCATION_STATUSES, LEAVE_UNITS } from "@peoplepay360/shared";

import type { FieldSpec, Refs } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

/**
 * The three records this screen writes, declared once each. The page passes
 * the loaded reference lists; the server actions call these bare, because
 * reading a submission only needs the names and types.
 */

export function requestFields(refs?: Partial<Refs>): FieldSpec[] {
  return [
    {
      // A filed request belongs to whoever it was filed for: the API keeps the
      // employee it already has and ignores the one a PATCH sends, so offering
      // the select on an edit would be a control that quietly does nothing.
      name: "employeeId",
      label: "Employee",
      type: "select",
      required: true,
      createOnly: true,
      options: refs?.employees,
    },
    {
      name: "typeId",
      label: "Type",
      type: "select",
      required: true,
      options: refs?.timeOffTypes,
    },
    { name: "dateFrom", label: "First day", type: "date", required: true },
    {
      name: "dateTo",
      label: "Last day",
      type: "date",
      required: true,
      hint: "The duration is counted from the employee's working schedule, so weekends and rest days are skipped.",
    },
    {
      name: "reason",
      label: "Reason",
      type: "textarea",
      clearable: true,
      placeholder: "Family wedding in Pune.",
      hint: "Up to 500 characters.",
    },
  ];
}

export function allocationFields(refs?: Partial<Refs>): FieldSpec[] {
  return [
    {
      // As with a request, the API drops the employee on an update rather than
      // moving the granted balance to someone else.
      name: "employeeId",
      label: "Employee",
      type: "select",
      required: true,
      createOnly: true,
      options: refs?.employees,
    },
    {
      name: "typeId",
      label: "Type",
      type: "select",
      required: true,
      options: refs?.timeOffTypes,
    },
    {
      name: "quantity",
      label: "Quantity",
      type: "number",
      required: true,
      min: 0.5,
      step: 0.5,
      hint: "Days or hours, whichever the type counts in.",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: statusOptions(ALLOCATION_STATUSES),
      hint: "Only an approved allocation can be drawn from.",
    },
    { name: "validFrom", label: "Valid from", type: "date", required: true },
    {
      name: "validTo",
      label: "Valid to",
      type: "date",
      clearable: true,
      hint: "Leave blank to let it run on.",
    },
    { name: "notes", label: "Notes", type: "textarea", clearable: true },
  ];
}

export function timeOffTypeFields(): FieldSpec[] {
  return [
    { name: "name", label: "Name", required: true, placeholder: "Annual leave" },
    {
      name: "code",
      label: "Code",
      required: true,
      placeholder: "ANNUAL",
      hint: "Letters, digits and underscores only.",
    },
    {
      name: "unit",
      label: "Counted in",
      type: "select",
      options: statusOptions(LEAVE_UNITS),
    },
    {
      name: "colorHex",
      label: "Colour",
      type: "color",
      hint: "The dot shown beside this type in every list.",
    },
    {
      name: "maxDaysPerRequest",
      label: "Most per request",
      type: "number",
      min: 1,
      step: 1,
      clearable: true,
      hint: "Leave blank for no cap.",
    },
    {
      name: "requiresAllocation",
      label: "Needs an allocation",
      type: "switch",
      hint: "Requests draw from a granted balance and are refused without one.",
    },
    {
      name: "requiresApproval",
      label: "Needs approval",
      type: "switch",
      hint: "Off approves a request the moment it is filed.",
    },
    {
      name: "paid",
      label: "Paid",
      type: "switch",
      hint: "Unpaid leave reduces net pay.",
    },
    {
      name: "active",
      label: "Active",
      type: "switch",
      hint: "An inactive type stays on the records that already use it.",
    },
  ];
}

/** The one line the refusal dialog collects, so a decision can carry a why. */
export function refusalFields(): FieldSpec[] {
  return [
    {
      name: "reason",
      label: "Reason",
      type: "textarea",
      span: "full",
      placeholder: "Not enough cover in the team that week.",
      hint: "Optional, and shown to the employee on their request.",
    },
  ];
}

/**
 * A switch the form renders unchecked posts false, which would quietly invert
 * the API's defaults on every new type. Seeding the create form with them
 * keeps the two in step.
 */
export const NEW_TYPE = {
  unit: "DAY",
  colorHex: "#2563eb",
  requiresAllocation: true,
  requiresApproval: true,
  paid: true,
  active: true,
};

/** An allocation is granted as a draft and approved separately. */
export const NEW_ALLOCATION = { status: "DRAFT" };
