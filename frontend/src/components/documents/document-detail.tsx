import Link from "next/link";
import {
  Download,
  FileText,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import type { DocumentDto, DocumentSignatureDto } from "@peoplepay360/shared";

import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button-variants";
import { SignPanel } from "@/components/documents/sign-panel";
import { SubmitRequestedPanel } from "@/components/documents/submit-panel";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONE,
  fileSize,
  formatDateTime,
} from "@/lib/format";

/** One fact from the certificate, laid out like every other detail row. */
function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "text-sm break-words"}>
        {value}
      </dd>
    </div>
  );
}

/**
 * One document, rendered the same in both places it is opened from.
 *
 * The admin panel and the employee space wrap it in very different shells, but
 * the document itself is the same thing to both, and two copies of a signing
 * screen is two chances for only one of them to be right. What differs is
 * passed in: whether this reader may manage it, and what to render if so.
 */
export function DocumentDetail({
  document,
  signature,
  isMine,
  actions,
}: {
  document: DocumentDto;
  signature: DocumentSignatureDto | null;
  /** Whether the reader is the person it was sent to. */
  isMine: boolean;
  /** HR's menu. Omitted in the employee space, which has no such verbs. */
  actions?: React.ReactNode;
}) {
  const hasFile = Boolean(document.file);

  return (

    <div className="flex flex-col gap-6">
      <PageHeader
        title={document.title}
        description={`${DOCUMENT_KIND_LABELS[document.kind]} · ${document.employee?.fullName}`}
        actions={
          <>
            <Badge variant={DOCUMENT_STATUS_TONE[document.status]}>
              {DOCUMENT_STATUS_LABELS[document.status]}
            </Badge>
            {actions}
          </>
        }
      />

      {document.message ? (
        <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed">
          {document.message}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {hasFile ? (
            <>
              {/* An iframe rather than a PDF library: the browser already has
                  a viewer, and shipping a second one to render what it can
                  already show is a megabyte for nothing. */}
              <iframe
                src={`/api/documents/${document.id}/file${
                  document.signedFile ? "" : "?version=original"
                }`}
                title={document.title}
                className="h-[70vh] min-h-96 w-full rounded-xl border border-border bg-muted/20"
              />

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/api/documents/${document.id}/file`}
                  target="_blank"
                  className={buttonVariants({ variant: "outline", size: "md" })}
                >
                  <Download className="size-4" />
                  {document.signedFile ? "Signed copy" : "Download"}
                </Link>

                {document.signedFile ? (
                  <Link
                    href={`/api/documents/${document.id}/file?version=original`}
                    target="_blank"
                    className={buttonVariants({ variant: "ghost", size: "md" })}
                  >
                    <FileText className="size-4" />
                    Original, as sent
                  </Link>
                ) : null}

                {document.file ? (
                  <span className="text-xs text-muted-foreground">
                    {document.file.filename} · {fileSize(document.file.size)}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm font-medium">Nothing attached yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {document.employee?.fullName} was asked for this and has not
                sent it.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {isMine && document.status === "AWAITING_SIGNATURE" ? (
            <SignPanel document={document} />
          ) : null}

          {isMine && document.status === "REQUESTED" ? (
            <SubmitRequestedPanel document={document} />
          ) : null}

          {signature ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="size-4" />
                </span>
                <h2 className="text-sm font-semibold">Signature</h2>
              </div>
              <dl className="flex flex-col gap-3">
                <Fact label="Signed by" value={signature.signerName ?? "—"} />
                <Fact label="Email" value={signature.signerEmail ?? "—"} />
                <Fact
                  label="Signed at"
                  value={
                    signature.signedAt ? formatDateTime(signature.signedAt) : "—"
                  }
                />
                <Fact
                  label="IP address"
                  value={signature.signerIp || "not recorded"}
                />
                <Fact
                  label="Document fingerprint"
                  value={signature.signedChecksum ?? "—"}
                  mono
                />
              </dl>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <MonitorSmartphone className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {signature.signerUserAgent || "Device not recorded"}
                </span>
              </p>
            </div>
          ) : null}

          {document.status === "DECLINED" ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <h2 className="text-sm font-semibold text-destructive">
                Declined
              </h2>
              <p className="mt-2 text-sm leading-relaxed">
                {document.declineReason}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">History</h2>
            <dl className="flex flex-col gap-3">
              <Fact
                label="Added by"
                value={`${document.createdBy.name} · ${formatDateTime(document.createdAt)}`}
              />
              {document.sentAt ? (
                <Fact label="Sent" value={formatDateTime(document.sentAt)} />
              ) : null}
              {document.submittedAt ? (
                <Fact
                  label="Supplied"
                  value={formatDateTime(document.submittedAt)}
                />
              ) : null}
            </dl>
          </div>
        </div>
      </div>
    </div>
  
  );
}
