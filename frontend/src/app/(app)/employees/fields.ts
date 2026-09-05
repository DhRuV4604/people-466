import { EMPLOYEE_STATUSES, EMPLOYEE_TYPES } from "@peoplepay360/shared";

import type { FieldSpec, Refs } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

const GENDERS = ["Female", "Male", "Other", "Prefer not to say"].map(
  (value) => ({ value, label: value }),
);

/**
 * The employee record, declared once. The page passes the loaded reference
 * lists; the server action calls it bare, because reading a submission only
 * needs the names and types.
 */
export function employeeFields(refs?: Partial<Refs>): FieldSpec[] {
  return [
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    {
      name: "workEmail",
      label: "Work email",
      type: "email",
      required: true,
      span: "full",
      placeholder: "name@company.com",
    },
    { name: "workPhone", label: "Phone", type: "tel", clearable: true },
    { name: "hireDate", label: "Hire date", type: "date", required: true },
    {
      name: "employeeType",
      label: "Employment type",
      type: "select",
      options: statusOptions(EMPLOYEE_TYPES),
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: statusOptions(EMPLOYEE_STATUSES),
    },
    {
      name: "departmentId",
      label: "Department",
      type: "select",
      options: refs?.departments,
      clearable: true,
    },
    {
      name: "jobPositionId",
      label: "Position",
      type: "select",
      options: refs?.positions,
      clearable: true,
    },
    {
      name: "managerId",
      label: "Manager",
      type: "select",
      options: refs?.employees,
      clearable: true,
    },
    {
      name: "workingScheduleId",
      label: "Working schedule",
      type: "select",
      options: refs?.schedules,
      clearable: true,
      hint: "Sets the weekly hours payroll uses for a day rate.",
    },
    {
      name: "bankName",
      label: "Bank",
      clearable: true,
      hint: "Payroll warns on a payslip when this is missing.",
    },
    {
      name: "bankAccountNumber",
      label: "Account number",
      clearable: true,
    },
    { name: "dateOfBirth", label: "Date of birth", type: "date", clearable: true },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: GENDERS,
      clearable: true,
    },
    { name: "exitDate", label: "Exit date", type: "date", clearable: true },
    { name: "address", label: "Address", type: "textarea", clearable: true },
  ];
}
