import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { DocumentDto, DocumentSignatureDto } from "@peoplepay360/shared";

import { BackLink } from "@/components/ui/page-header";
import { DocumentDetail } from "@/components/documents/document-detail";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireMe } from "@/lib/access";

export const metadata: Metadata = { title: "Document" };

/**
 * The same document, in the employee's own space.
 *
 * It has its own route rather than linking into the admin panel: someone
 * signing a joining letter should not be dropped into a sidebar full of pay
 * runs and audit logs to do it.
 */
export default async function MyDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireMe();
  const { id } = await params;

  let document: DocumentDto;
  try {
    document = await apiFetch<DocumentDto>(`/documents/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const signature =
    document.status === "SIGNED"
      ? await apiFetch<DocumentSignatureDto>(`/documents/${id}/signature`)
      : null;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/me/documents">Documents</BackLink>
      <DocumentDetail
        document={document}
        signature={signature}
        isMine={document.employeeId === me.employeeId}
      />
    </div>
  );
}
