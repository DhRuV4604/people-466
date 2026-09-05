import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserX } from "lucide-react";
import {
  EMPLOYEE_TYPES,
  can,
  type EligibleEmployeeDto,
} from "@peoplepay360/shared";

import {
  EmptyState,
  Fact,
  FactGrid,
  Section,
  StatGrid,
  StatTile,
} from "@/components/data/primitives";
import { RecordForm } from "@/components/form";
import { BackLink, PageHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import type { Refs } from "@/lib/fields";
import { dateRange } from "@/lib/format";
import { loadRefs } from "@/lib/refs";
import { statusLabel } from "@/lib/status";
import { requireAccess } from "@/lib/access";

import { choosePayrunScope, createPayrun, type PayrunScope } from "../actions";
import { payrunRosterFields, payrunScopeFields } from "../fields";

export const metadata: Metadata = {
  title: "New pay run",
  description: "Choose the period, then the people it pays.",
};

type SearchParams = Promise<{
  step?: string;
  name?: string;
  structureId?: string;
  periodStart?: string;
  periodEnd?: string;
  departmentId?: string;
  employeeType?: string;
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The URL is the wizard's state. A complete scope in it means the eligibility
 * question can be asked, which is step two; anything less is step one.
 */
function readScope(
  params: Awaited<SearchParams>,
  refs: Refs,
): PayrunScope | null {
  const { name, structureId, periodStart, periodEnd } = params;
  if (!name || !structureId) return null;
  if (!periodStart || !ISO_DATE.test(periodStart)) return null;
  if (!periodEnd || !ISO_DATE.test(periodEnd)) return null;
  // A hand-edited URL can invert the period, which the API only rejects at
  // create; sending it back to step one is more use than an empty roster.
  if (periodEnd < periodStart) return null;

  // The URL is shareable, so it can also be edited or go stale. Anything the
  // eligibility query would reject belongs on step one, not on an error page.
  if (!refs.structures.some((option) => option.value === structureId)) {
    return null;
  }
  if (
    params.departmentId &&
    !refs.departments.some((option) => option.value === params.departmentId)
  ) {
    return null;
  }
  if (
    params.employeeType &&
    !(EMPLOYEE_TYPES as readonly string[]).includes(params.employeeType)
  ) {
    return null;
  }

  return {
    name,
    structureId,
    periodStart,
    periodEnd,
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    ...(params.employeeType ? { employeeType: params.employeeType } : {}),
  };
}

export default async function NewPayrunPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("payruns");
  if (!can(session.role, "payruns", "create")) redirect("/payruns");

  const params = await searchParams;
  const refs = await loadRefs(["structures", "departments"]);
  // `step=1` is how step two sends you back with your answers intact.
  const scope = params.step === "1" ? null : readScope(params, refs);

  if (!scope) {
    return (
      <>
        <PageHeader
          above={<BackLink href="/payruns">All pay runs</BackLink>}
          title="New pay run"
          description="Step 1 of 2. The period and the structure decide who can be paid, so they come first."
        />

        <Section
          title="What this run covers"
          description="Nothing is created yet. These answers only ask the question."
        >
          <RecordForm
            fields={payrunScopeFields(refs)}
            defaults={{
              name: params.name,
              structureId: params.structureId,
              periodStart: params.periodStart,
              periodEnd: params.periodEnd,
              departmentId: params.departmentId,
              employeeType: params.employeeType,
            }}
            action={choosePayrunScope}
            submitLabel="Find employees"
          />
        </Section>
      </>
    );
  }

  const people = await apiFetch<EligibleEmployeeDto[]>(
    "/payruns/eligible-employees",
    {
      query: {
        periodStart: scope.periodStart,
        periodEnd: scope.periodEnd,
        structureId: scope.structureId,
        departmentId: scope.departmentId,
        employeeType: scope.employeeType,
      },
    },
  );

  const eligible = people.filter((person) => person.eligible);
  const warned = eligible.filter((person) => person.warning).length;

  const structureName =
    refs.structures.find((option) => option.value === scope.structureId)
      ?.label ?? scope.structureId;
  const departmentName = scope.departmentId
    ? (refs.departments.find((option) => option.value === scope.departmentId)
        ?.label ?? scope.departmentId)
    : "All departments";

  const back = new URLSearchParams({ step: "1" });
  for (const [key, value] of Object.entries(scope)) {
    if (value) back.set(key, value);
  }

  return (
    <>
      <PageHeader
        above={
          <BackLink href={`/payruns/new?${back.toString()}`}>
            Change what this run covers
          </BackLink>
        }
        title={scope.name}
        description="Step 2 of 2. Everyone eligible is ticked already. Anyone who cannot be paid for this period is listed with the reason and cannot be chosen."
      />

      <StatGrid>
        <StatTile
          label="Employees"
          value={people.length}
          hint="Considered for this period"
        />
        <StatTile
          label="Eligible"
          value={eligible.length}
          hint="Ticked below"
          tone="accent"
        />
        <StatTile
          label="Not eligible"
          value={people.length - eligible.length}
          hint="Each says why"
        />
        <StatTile
          label="Warnings"
          value={warned}
          hint={
            warned === 0
              ? "Nothing to check"
              : "Payable, but check before validating"
          }
          tone={warned > 0 ? "danger" : "neutral"}
        />
      </StatGrid>

      <Section
        title="What this run covers"
        description="Set on the previous step."
      >
        <FactGrid columns={4}>
          <Fact label="Period">
            {dateRange(scope.periodStart, scope.periodEnd)}
          </Fact>
          <Fact label="Salary structure">{structureName}</Fact>
          <Fact label="Department">{departmentName}</Fact>
          <Fact label="Employment type">
            {scope.employeeType ? statusLabel(scope.employeeType) : "All types"}
          </Fact>
        </FactGrid>
      </Section>

      <Section
        title="Who this run pays"
        description="Only the ticked people get a payslip in this run."
      >
        {people.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="Nobody matches those filters"
            description="Widen the department or the employment type on the previous step."
          />
        ) : (
          <RecordForm
            fields={payrunRosterFields(people)}
            defaults={{ employeeIds: eligible.map((person) => person.id) }}
            action={createPayrun.bind(null, scope)}
            submitLabel="Create pay run"
          />
        )}
      </Section>
    </>
  );
}
