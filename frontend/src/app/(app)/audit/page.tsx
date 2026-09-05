import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  type AuditLogDto,
  type Paginated,
} from "@peoplepay360/shared";

import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { EmptyState } from "@/components/data/primitives";
import { apiFetch } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";

import { AUDITED_ENTITIES, entityLabel } from "./_components/audit-format";
import { AuditTrail } from "./_components/audit-trail";

export const metadata: Metadata = {
  title: "Audit trail",
  description: "Who changed what, and what it was before.",
};

type SearchParams = Promise<{
  page?: string;
  pageSize?: string;
  q?: string;
  action?: string;
  entity?: string;
}>;

/** The trail only grows, so a page of it is the newest matches. Anything older
 *  is reached by narrowing the filters rather than by scrolling. */
/** What the API accepts for `q`. Past it the request is rejected and the whole
 *  screen falls into the error boundary, so a pasted essay is cut instead - it
 *  was never going to match anything the first 200 characters did not. */
const MAX_SEARCH = 200;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Admin only. Every other role lands on a screen it can actually open
  // rather than on an empty trail.
  await requireAccess("auditLogs");

  const params = await searchParams;

  const logPage = await apiFetch<Paginated<AuditLogDto>>("/audit-logs", {
    query: {
      ...pageQuery(params),
      q: params.q?.slice(0, MAX_SEARCH),
      action: params.action,
      entity: params.entity,
    },
  });

  const rows = logPage.items;

  // `entity` is free text, so a model the trail has learned about since this
  // list was written is still filterable once it shows up in the results.
  const entities = Array.from(
    new Set([...AUDITED_ENTITIES, ...rows.map((row) => row.entity)]),
  );

  const hasFilters = Boolean(params.q || params.action || params.entity);

  return (
    <>
      <FilterBar
        search={{ placeholder: "Search person or record" }}
        selects={[
          {
            key: "action",
            placeholder: "Any action",
            width: "w-44",
            options: AUDIT_ACTIONS.map((action) => ({
              value: action,
              label: AUDIT_ACTION_LABELS[action],
            })),
          },
          {
            key: "entity",
            placeholder: "Anything",
            width: "w-48",
            options: entities.map((entity) => ({
              value: entity,
              label: entityLabel(entity),
            })),
          },
        ]}
        // What an admin opens this screen to find: what went missing, and what
        // was waved through.
        quickFilters={[
          { key: "action", value: "DELETE", label: "Deletions" },
          { key: "action", value: "APPROVE", label: "Approvals" },
        ]}
        count={{ total: logPage.total, noun: "entry", plural: "entries" }}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={hasFilters ? "Nothing matches those filters" : "Nothing recorded yet"}
          description={
            hasFilters
              ? "Try a broader search, or clear a filter to widen the results."
              : "Every change made through the app lands here: who made it, to which record, and what it was before."
          }
        />
      ) : (
        <AuditTrail rows={rows} />
      )}

      <Pagination meta={logPage} noun="entry" plural="entries" />
    </>
  );
}
