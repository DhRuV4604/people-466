"use client";

import { Ban, Send } from "lucide-react";
import type { DocumentDto } from "@peoplepay360/shared";

import { RowActions } from "@/components/form";

import { cancelDocument, sendDocument } from "../actions";

/**
 * What HR can do to a document from its own page.
 *
 * Sending only appears on a draft and withdrawing disappears once it is
 * signed, so the menu never offers something the API would refuse — the API
 * refuses it anyway, but a menu full of dead entries is its own problem.
 */
export function DocumentActions({ document }: { document: DocumentDto }) {
  const items = [];

  if (document.status === "DRAFT") {
    items.push({
      label: "Send",
      icon: <Send />,
      action: sendDocument.bind(null, document.id),
    });
  }

  if (document.status !== "SIGNED" && document.status !== "CANCELLED") {
    items.push({
      label: "Withdraw",
      icon: <Ban />,
      destructive: true,
      action: cancelDocument.bind(null, document.id),
      confirm: {
        title: `Withdraw ${document.title}?`,
        description:
          "It stops waiting on them and stays on the record as withdrawn. Nothing reopens it, so it would have to be sent again.",
        confirmLabel: "Withdraw",
        destructive: true,
      },
    });
  }

  return <RowActions items={items} />;
}
