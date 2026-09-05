import { COMPUTE_TYPES, RULE_CATEGORIES } from "@peoplepay360/shared";

import type { FieldSpec, Refs } from "@/lib/fields";
import { statusOptions } from "@/lib/status";

/**
 * What a create form starts from. An untouched switch submits nothing, which
 * reads as false, so the API's own defaults have to be spelled out here or a
 * new structure would arrive inactive.
 */
export const NEW_STRUCTURE: Record<string, unknown> = { active: true };

export const NEW_RULE: Record<string, unknown> = {
  sequence: 100,
  computeType: "FIXED",
  appearsOnPayslip: true,
  active: true,
};

/**
 * A structure is little more than a name a contract can point at, so the form
 * is four fields. The code is what payroll history is keyed on, which is why
 * the API narrows it to letters, digits and underscores.
 */
export function structureFields(): FieldSpec[] {
  return [
    { name: "name", label: "Name", required: true, placeholder: "Regular salary" },
    {
      name: "code",
      label: "Code",
      required: true,
      placeholder: "REG",
      hint: "Letters, digits and underscores only. Stored in upper case.",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      clearable: true,
      hint: "What this structure is for, so the next person picking one can tell them apart.",
    },
    {
      name: "active",
      label: "Active",
      type: "switch",
      hint: "Retires the structure. Nothing enforces it — a contract can still point at an inactive one — but it sorts last, and a delete blocked by existing payslips falls back to it.",
    },
  ];
}

/**
 * A rule, in the order it reads: what it is, where it sits in the run, then
 * how it arrives at a number.
 *
 * The three amount inputs are all shown at once rather than swapped in behind
 * the compute type, because a field spec is static data the server renders
 * once — it has no way to react to another field. Showing all three is also
 * the honest picture of what happens on save: the API keeps only the amount
 * matching the chosen compute type and clears the other two, so a rule moved
 * from fixed to formula cannot carry a stale amount. Each hint names the
 * compute type it belongs to.
 */
export function ruleFields(refs?: Partial<Refs>): FieldSpec[] {
  return [
    { name: "name", label: "Name", required: true, placeholder: "House rent allowance" },
    {
      name: "code",
      label: "Code",
      required: true,
      placeholder: "HRA",
      hint: "Later rules refer to this code in their formulas. Upper-cased on save with spaces turned into underscores, and unique within the structure.",
    },
    {
      name: "structureId",
      label: "Structure",
      type: "select",
      required: true,
      options: refs?.structures,
    },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: statusOptions(RULE_CATEGORIES),
      hint: "Groups the line on the payslip and decides whether it adds or subtracts.",
    },
    {
      name: "sequence",
      label: "Sequence",
      type: "number",
      step: 1,
      placeholder: "100",
      hint: "Lower values compute first, so a rule can use one above it.",
    },
    {
      name: "computeType",
      label: "Compute type",
      type: "select",
      options: statusOptions(COMPUTE_TYPES),
      span: "full",
      hint: "Decides which of the three amounts below is used. The other two are cleared on save. Defaults to fixed.",
    },
    {
      name: "amountFixed",
      label: "Fixed amount",
      type: "number",
      step: 0.01,
      hint: "Fixed rules only.",
    },
    {
      name: "amountPercentage",
      label: "Percentage",
      type: "number",
      step: 0.01,
      hint: "Percentage rules only.",
    },
    {
      name: "percentageBase",
      label: "Percentage of",
      placeholder: "BASIC",
      hint: "The rule code the percentage applies to. Percentage rules only.",
    },
    {
      name: "formula",
      label: "Formula",
      type: "textarea",
      placeholder: "GROSS - PF - PT - TDS",
      hint: "Formula rules only. Written in rule codes, and rejected on save if it does not compute.",
    },
    {
      name: "condition",
      label: "Condition",
      type: "textarea",
      placeholder: "GROSS > 15000",
      hint: "The rule is skipped for a payslip where this is false. Leave blank to always apply it.",
    },
    {
      name: "appearsOnPayslip",
      label: "Shown on payslip",
      type: "switch",
      hint: "Turn off for a working figure the employee should not see as a line.",
    },
    {
      name: "active",
      label: "Active",
      type: "switch",
      hint: "An inactive rule is skipped entirely when a payslip is computed.",
    },
    {
      name: "note",
      label: "Note",
      clearable: true,
      span: "full",
      hint: "Internal only. Never printed on a payslip.",
    },
  ];
}
