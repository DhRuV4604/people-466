import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, SearchX } from "lucide-react";
import {
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  can,
  type DocumentDto,
  type Paginated,
} from "@peoplepay360/shared";

import { FilterBar } from "@/components/data/filter-bar";
import { EmptyState } from "@/components/data/primitives";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { Badge, UserAvatar } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { loadRefs } from "@/lib/refs";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
  formatDate,
} from "@/lib/format";
import { requireAccess } from "@/lib/access";

import {
  RequestDocumentDialog,
  UploadDocumentDialog,
} from "./_components/document-dialogs";

export const metadata: Metadata = {
  title: "Documents",
  description: "What has been sent, signed, and asked for.",
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  kind?: string;
  employeeId?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAccess("documents");
  const params = await searchParams;

  const [documentPage, refs] = await Promise.all([
    apiFetch<Paginated<DocumentDto>>("/documents", {
      query: {
        ...pageQuery(params),
        q: params.q,
        status: params.status,
        kind: params.kind,
        employeeId: params.employeeId,
      },
    }),
    loadRefs(["employees"]),
  ]);

  const documents = documentPage.items;
  const canCreate = can(session.role, "documents", "create");
  const hasFilters = Boolean(
    params.q || params.status || params.kind || params.employeeId,
  );

  return (
    <>
      <FilterBar
        search={{ placeholder: "Search document or employee" }}
        selects={[
          {
            key: "status",
            placeholder: "Any status",
            width: "w-48",
            options: DOCUMENT_STATUSES.map((status) => ({
              value: status,
              label: DOCUMENT_STATUS_LABELS[status],
            })),
          },
          {
            key: "kind",
            placeholder: "Any type",
            width: "w-44",
            options: DOCUMENT_KINDS.map((kind) => ({
              value: kind,
              label: DOCUMENT_KIND_LABELS[kind],
            })),
          },
        ]}
        quickFilters={[
          {
            key: "status",
            value: "AWAITING_SIGNATURE",
            label: "Awaiting signature",
          },
          { key: "status", value: "REQUESTED", label: "Requested" },
        ]}
        count={{ total: documentPage.total, noun: "document" }}
        actions={
          canCreate ? (
            <>
              <RequestDocumentDialog employees={refs.employees} />
              <UploadDocumentDialog employees={refs.employees} />
            </>
          ) : null
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={hasFilters ? SearchX : FileSignature}
          title={hasFilters ? "Nothing matches" : "No documents yet"}
          description={
            hasFilters
              ? "Try a wider filter."
              : "Add a joining letter or an NDA to someone's file, or ask them for a document you need."
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {documents.map((document) => (
              <li
                key={document.id}
                className="relative flex items-center gap-4 p-4 transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
              >
                <Link
                  href={`/documents/${document.id}`}
                  className="absolute inset-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="sr-only">Open {document.title}</span>
                </Link>

                <UserAvatar name={document.employee?.fullName ?? "?"} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {document.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {document.employee?.fullName} ·{" "}
                    {DOCUMENT_KIND_LABELS[document.kind]}
                  </p>
                </div>

                <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatDate(document.signedAt ?? document.createdAt)}
                </p>

                <Badge variant={DOCUMENT_STATUS_TONE[document.status]}>
                  {DOCUMENT_STATUS_LABELS[document.status]}
                </Badge>
              </li>
            ))}
          </ul>

          <Pagination meta={documentPage} noun="document" />
        </>
      )}
    </>
  );
}
