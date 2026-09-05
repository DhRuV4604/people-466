import { CONTRACT_STATUSES, CONTRACT_TYPES } from "@peoplepay360/shared";

import type { FieldSpec, Refs } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

/**
 * The contract record, declared once. The page passes the loaded reference
 * lists; the server action calls it bare, because reading a submission only
 * needs the names and types.
 */
export function contractFields(refs?: Partial<Refs>): FieldSpec[] {
  return [
    {
      name: "name",
      label: "Name",
      required: true,
      span: "full",
      placeholder: "Priya Patel — Senior Engineer 2026",
    },
    {
      name: "employeeId",
      label: "Employee",
      type: "select",
      required: true,
      options: refs?.employees,
      // The API ignores employeeId on an update, so offering it on the edit
      // form would silently do nothing. Write the contract for someone else
      // instead.
      createOnly: true,
      hint: "A contract cannot be moved to another employee later.",
    },
    {
      name: "contractType",
      label: "Contract type",
      type: "select",
      options: statusOptions(CONTRACT_TYPES),
    },
    { name: "dateStart", label: "Start date", type: "date", required: true },
    {
      name: "dateEnd",
      label: "End date",
      type: "date",
      clearable: true,
      hint: "Leave blank for an open-ended contract.",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: statusOptions(CONTRACT_STATUSES),
      hint: "Two running contracts cannot overlap for the same employee.",
    },
    {
      name: "wage",
      label: "Wage",
      type: "number",
      required: true,
      min: 0,
      step: 0.01,
      hint: "The base figure the salary rules compute a payslip from.",
    },
    {
      name: "jobPositionId",
      label: "Position",
      type: "select",
      options: refs?.positions,
      clearable: true,
    },
    {
      name: "workingScheduleId",
      label: "Working schedule",
      type: "select",
      options: refs?.schedules,
      clearable: true,
      hint: "Overrides the employee's own schedule when payroll counts the days worked.",
    },
    {
      name: "salaryStructureId",
      label: "Salary structure",
      type: "select",
      options: refs?.structures,
      clearable: true,
      hint: "A pay run warns when it is built on a different structure.",
    },
    { name: "notes", label: "Notes", type: "textarea", clearable: true },
  ];
}
