import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  can,
  type DocumentDto,
  type DocumentSignatureDto,
} from "@peoplepay360/shared";

import { DocumentDetail } from "@/components/documents/document-detail";
import { DocumentActions } from "../_components/document-actions";
import { ApiError, apiFetch } from "@/lib/api-client";
import { requireAccess } from "@/lib/access";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAccess("documents");
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
    <DocumentDetail
      document={document}
      signature={signature}
      isMine={document.employeeId === session.employeeId}
      actions={
        can(session.role, "documents", "update") ? (
          <DocumentActions document={document} />
        ) : null
      }
    />
  );
}
