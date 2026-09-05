import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileSignature, PenLine, Upload } from "lucide-react";
import type { DocumentDto, Paginated } from "@peoplepay360/shared";

import { EmptyState } from "@/components/data/primitives";
import { Badge, Card } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireMe } from "@/lib/access";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
  formatDate,
} from "@/lib/format";
import { ALL_ROWS, emptyPage } from "@/lib/paged";

export const metadata: Metadata = { title: "Documents" };

/**
 * Worded from the employee's side.
 *
 * The admin list says "Awaiting signature", which describes what HR is waiting
 * for. Here the same row has to say what *they* have to do, or it reads as
 * something happening elsewhere.
 */
const ASK: Partial<Record<DocumentDto["status"], string>> = {
  AWAITING_SIGNATURE: "Waiting for your signature",
  REQUESTED: "They need this from you",
};

function DocumentRow({ document }: { document: DocumentDto }) {
  const todo = ASK[document.status];

  return (
    <li>
      <Link
        href={`/me/documents/${document.id}`}
        className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        <span
          className={
            todo
              ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
          }
        >
          {document.status === "AWAITING_SIGNATURE" ? (
            <PenLine className="size-4" />
          ) : document.status === "REQUESTED" ? (
            <Upload className="size-4" />
          ) : (
            <FileSignature className="size-4" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {document.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {todo ?? `${DOCUMENT_KIND_LABELS[document.kind]} · ${formatDate(document.signedAt ?? document.createdAt)}`}
          </span>
        </span>

        {todo ? (
          <Badge variant="default">Action</Badge>
        ) : (
          <Badge variant={DOCUMENT_STATUS_TONE[document.status]}>
            {DOCUMENT_STATUS_LABELS[document.status]}
          </Badge>
        )}

        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export default async function MyDocumentsPage() {
  await requireMe();

  let documents: Paginated<DocumentDto>;
  try {
    documents = await apiFetch<Paginated<DocumentDto>>("/documents", {
      query: { pageSize: ALL_ROWS },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    documents = emptyPage<DocumentDto>();
  }

  // Anything waiting on them goes first, whatever its date. A signature to
  // give is the only reason most people open this screen.
  const waiting = documents.items.filter((d) => ASK[d.status]);
  const rest = documents.items.filter((d) => !ASK[d.status]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything in your file, and anything waiting on you.
        </p>
      </header>

      {documents.items.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nothing here yet"
          description="Letters, contracts and anything HR asks you for will show up here."
        />
      ) : (
        <>
          {waiting.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Waiting on you
              </h2>
              <Card className="overflow-hidden p-0">
                <ul className="divide-y divide-border">
                  {waiting.map((document) => (
                    <DocumentRow key={document.id} document={document} />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Your file
              </h2>
              <Card className="overflow-hidden p-0">
                <ul className="divide-y divide-border">
                  {rest.map((document) => (
                    <DocumentRow key={document.id} document={document} />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
