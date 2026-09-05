import type { Metadata } from "next";
import { Calculator } from "lucide-react";
import {
  RULE_CATEGORIES,
  can,
  type SalaryRuleDto,
  type SalaryStructureDto,
  type Paginated,
} from "@peoplepay360/shared";

import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { EmptyState, Section } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { RecordDialog, RowActions } from "@/components/form";
import { Badge } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { money } from "@/lib/format";
import { statusOptions } from "@/lib/status";
import { requireAccess } from "@/lib/access";
import { emptyPage } from "@/lib/paged";
import { loadRefs } from "@/lib/refs";

import { deleteRule, deleteStructure, saveRule, saveStructure } from "./actions";
import { NEW_RULE, NEW_STRUCTURE, ruleFields, structureFields } from "./fields";

export const metadata: Metadata = {
  title: "Salary",
  description: "Structures and the rules that compute pay.",
};

type SearchParams = Promise<{
  structPage?: string;
  structPageSize?: string;
  rulePage?: string;
  rulePageSize?: string;
  q?: string;
  structureId?: string;
  category?: string;
}>;

/** Describes how a rule arrives at its number, in one line. */
function computeSummary(rule: SalaryRuleDto): string {
  if (rule.computeType === "FIXED") return money(rule.amountFixed ?? 0);
  if (rule.computeType === "PERCENTAGE") {
    return `${rule.amountPercentage ?? 0}% of ${rule.percentageBase ?? "basic"}`;
  }
  return rule.formula ?? "Formula";
}

export default async function SalaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("salaryStructures");

  const params = await searchParams;

  const [structurePage, rulePage, refs] = await Promise.all([
    apiFetch<Paginated<SalaryStructureDto>>("/salary-structures", {
      query: pageQuery(params, "struct"),
    }).catch((error) => {
      if (error instanceof ApiError) return emptyPage<SalaryStructureDto>();
      throw error;
    }),
    apiFetch<Paginated<SalaryRuleDto>>("/salary-rules", {
      query: {
        ...pageQuery(params, "rule"),
        q: params.q,
        structureId: params.structureId,
        category: params.category,
      },
    }),
    loadRefs(["structures"]),
  ]);

  const structures = structurePage.items;
  const rules = rulePage.items;

  // The rule form's structure select and the rule filter must offer every
  // structure, not the page of them on screen, so these come from loadRefs
  // rather than from the cards above.
  const structureOptions = refs.structures;

  const hasRuleFilters = Boolean(
    params.q || params.structureId || params.category,
  );

  const canCreateStructure = can(session.role, "salaryStructures", "create");
  const canEditStructure = can(session.role, "salaryStructures", "update");
  const canDeleteStructure = can(session.role, "salaryStructures", "delete");
  const canCreateRule = can(session.role, "salaryRules", "create");
  const canEditRule = can(session.role, "salaryRules", "update");
  const canDeleteRule = can(session.role, "salaryRules", "delete");

  const ruleColumns: Column<SalaryRuleDto>[] = [
    {
      header: "#",
      className: "w-12",
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.sequence}
        </span>
      ),
    },
    {
      header: "Rule",
      className: "min-w-[200px]",
      cell: (row) => (
        <>
          <span className="block truncate font-medium">{row.name}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {row.code}
          </span>
        </>
      ),
    },
    {
      header: "Structure",
      hideBelow: "lg",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.structure?.name ?? "—"}
        </span>
      ),
    },
    {
      header: "Category",
      cell: (row) => <StatusBadge value={row.category} />,
    },
    {
      header: "Computes",
      hideBelow: "md",
      cell: (row) => (
        <span className="text-muted-foreground">{computeSummary(row)}</span>
      ),
    },
    {
      header: "On payslip",
      align: "right",
      hideBelow: "xl",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.appearsOnPayslip ? "Yes" : "Hidden"}
        </span>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (row) =>
        row.active ? null : <Badge variant="outline">Inactive</Badge>,
    },
  ];

  if (canEditRule || canDeleteRule) {
    ruleColumns.push({
      header: "",
      align: "right",
      className: "w-12",
      cell: (row) => (
        <RowActions
          edit={
            canEditRule
              ? {
                  title: "Edit rule",
                  description:
                    "Only the amount matching the compute type is kept. The other two are cleared on save.",
                  fields: ruleFields({ structures: structureOptions }),
                  action: saveRule,
                  // Spread because the dialog takes a plain record, and an
                  // interface has no index signature to satisfy that.
                  record: { ...row },
                }
              : undefined
          }
          remove={
            canDeleteRule
              ? {
                  action: deleteRule.bind(null, row.id),
                  title: `Delete ${row.name}?`,
                  description:
                    "A rule already used on a payslip is deactivated instead, so past payslips still add up.",
                }
              : undefined
          }
        />
      ),
    });
  }

  return (
    <>
      <Section
        title="Structures"
        description="What a contract points at to decide how its pay is computed."
        action={
          canCreateStructure ? (
            <RecordDialog
              title="New structure"
              description="A structure groups the rules that compute a payslip. Add its rules once it exists."
              fields={structureFields()}
              record={NEW_STRUCTURE}
              action={saveStructure}
              submitLabel="Create structure"
            />
          ) : null
        }
      >
        {structures.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No salary structures defined.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {structures.map((structure) => (
              <div
                key={structure.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{structure.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {structure.code}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={structure.active ? "secondary" : "outline"}>
                      {structure.active ? "Active" : "Inactive"}
                    </Badge>
                    <RowActions
                      edit={
                        canEditStructure
                          ? {
                              title: "Edit structure",
                              fields: structureFields(),
                              action: saveStructure,
                              record: { ...structure },
                            }
                          : undefined
                      }
                      remove={
                        canDeleteStructure
                          ? {
                              action: deleteStructure.bind(null, structure.id),
                              title: `Delete ${structure.name}?`,
                              description:
                                "Its rules go with it, and any contract pointing at it is left without a structure. One already used on a payslip is deactivated instead, so the history keeps it.",
                            }
                          : undefined
                      }
                    />
                  </div>
                </div>
                {structure.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {structure.description}
                  </p>
                ) : null}
                {structure.counts ? (
                  <p className="mt-3 text-xs text-muted-foreground tabular-nums">
                    {structure.counts.rules} rules ·{" "}
                    {structure.counts.contracts} contracts ·{" "}
                    {structure.counts.payslips} payslips
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <Pagination meta={structurePage} noun="structure" param="struct" />
      </Section>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Rules</h2>

        <FilterBar
          search={{ placeholder: "Search rule name or code" }}
          selects={[
            {
              key: "structureId",
              placeholder: "Any structure",
              options: structureOptions,
              width: "w-52",
            },
            {
              key: "category",
              placeholder: "Any category",
              options: statusOptions(RULE_CATEGORIES),
              width: "w-44",
            },
          ]}
          count={{ total: rulePage.total, noun: "rule" }}
          actions={
            canCreateRule ? (
              <RecordDialog
                title="New rule"
                description="Pick a compute type, then fill in the one amount below that matches it."
                fields={ruleFields({ structures: structureOptions })}
                record={NEW_RULE}
                action={saveRule}
                submitLabel="Create rule"
              />
            ) : null
          }
        />

        {rules.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title={hasRuleFilters ? "No rules match" : "No rules yet"}
            description={
              hasRuleFilters
                ? "Try a broader search, or clear a filter to widen the results."
                : "A structure computes nothing until it has rules. Add the basic wage first, then whatever is layered on top of it."
            }
          />
        ) : (
          <DataTable
            rows={rules}
            getKey={(row) => row.id}
            columns={ruleColumns}
          />
        )}

        <Pagination meta={rulePage} noun="rule" param="rule" />
      </div>
    </>
  );
}
