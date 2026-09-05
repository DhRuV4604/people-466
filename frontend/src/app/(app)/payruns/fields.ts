import { EMPLOYEE_TYPES, type EligibleEmployeeDto } from "@peoplepay360/shared";

import type { FieldOption, FieldSpec, Refs } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

/**
 * Step one of creating a run: what it covers. None of this is written on its
 * own, because who can be paid follows from the period and the structure, and
 * only the API knows that.
 */
export function payrunScopeFields(refs?: Partial<Refs>): FieldSpec[] {
  return [
    {
      name: "name",
      label: "Name",
      required: true,
      span: "full",
      placeholder: "Monthly payroll — August 2026",
    },
    {
      name: "structureId",
      label: "Salary structure",
      type: "select",
      required: true,
      span: "full",
      options: refs?.structures,
      hint: "Its rules compute every payslip in the run.",
    },
    {
      name: "periodStart",
      label: "Period start",
      type: "date",
      required: true,
    },
    { name: "periodEnd", label: "Period end", type: "date", required: true },
    {
      name: "departmentId",
      label: "Department",
      type: "select",
      options: refs?.departments,
      clearable: true,
      hint: "Leave blank to consider everyone.",
    },
    {
      name: "employeeType",
      label: "Employment type",
      type: "select",
      options: statusOptions(EMPLOYEE_TYPES),
      hint: "Narrows who the next step offers.",
    },
  ];
}

/**
 * An option carries a label and nothing else, so the API's own reason or
 * warning goes into it rather than being reworded here.
 */
function rosterOption(person: EligibleEmployeeDto): FieldOption {
  // The API sends an em dash for a missing department, which would read as a
  // second separator once the note is appended.
  const who = [person.fullName, person.employeeCode, person.department]
    .filter((part) => part && part !== "—")
    .join(" · ");
  const note = person.reason ?? person.warning;

  return {
    value: person.id,
    label: note ? `${who} — ${note}` : who,
    // Ineligible people stay on the list so the reason is visible, but the
    // API would reject them, so they cannot be ticked.
    disabled: !person.eligible,
  };
}

/** Step two: who the run actually pays. */
export function payrunRosterFields(
  people?: EligibleEmployeeDto[],
): FieldSpec[] {
  return [
    {
      name: "employeeIds",
      label: "Employee",
      type: "multiselect",
      required: true,
      span: "full",
      options: people?.map(rosterOption),
      hint: "Everyone eligible is ticked. Untick anyone this run should skip; the rest cannot be paid for this period and say why.",
    },
  ];
}
