import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import {
  DOCUMENT_STATUSES,
  can,
  type DocumentDto,
  type Paginated,
} from "@peoplepay360/shared";

import { FilterBar } from "@/components/data/filter-bar";
import { Pagination } from "@/components/data/pagination";
import { pageQuery } from "@/components/data/pagination-params";
import { EmptyState } from "@/components/data/primitives";
import { Badge } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
  formatDate,
} from "@/lib/format";

import {
  RequestDocumentDialog,
  UploadDocumentDialog,
} from "@/app/(app)/documents/_components/document-dialogs";
import { DraftDocumentDialog } from "@/app/(app)/documents/_components/draft-dialog";

import { requireEmployeeTab } from "../_lib";

export const metadata: Metadata = { title: "Documents" };

type SearchParams = Promise<{
  status?: string;
  page?: string;
  pageSize?: string;
}>;

/**
 * This person's file.
 *
 * The same rows as the main documents screen, already narrowed to them, and
 * the three ways of adding one arrive with the employee filled in — opening
 * this tab is already saying who it is for.
 */
export default async function EmployeeDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { session, employee } = await requireEmployeeTab(id, "documents");
  const query = await searchParams;

  const status = DOCUMENT_STATUSES.some((value) => value === query.status)
    ? query.status
    : undefined;

  const documentPage = await apiFetch<Paginated<DocumentDto>>("/documents", {
    query: { ...pageQuery(query), employeeId: employee.id, status },
  });

  const documents = documentPage.items;
  const canCreate = can(session.role, "documents", "create");

  return (
    <>
      <FilterBar
        selects={[
          {
            key: "status",
            placeholder: "Any status",
            width: "w-48",
            options: DOCUMENT_STATUSES.map((value) => ({
              value,
              label: DOCUMENT_STATUS_LABELS[value],
            })),
          },
        ]}
        count={{ total: documentPage.total, noun: "document" }}
        actions={
          canCreate ? (
            <>
              <RequestDocumentDialog employees={[]} employeeId={employee.id} />
              <DraftDocumentDialog employees={[]} employeeId={employee.id} />
              <UploadDocumentDialog employees={[]} employeeId={employee.id} />
            </>
          ) : null
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nothing on file yet"
          description={`Add a joining letter or an NDA for ${employee.firstName}, or ask them for a document you need.`}
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

                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileSignature className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {document.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {DOCUMENT_KIND_LABELS[document.kind]} ·{" "}
                    {formatDate(document.signedAt ?? document.createdAt)}
                  </p>
                </div>

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
