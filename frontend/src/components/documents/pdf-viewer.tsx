"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * The viewer, loaded only in the browser.
 *
 * pdf.js reaches for `DOMMatrix` and friends at import time. A "use client"
 * component is still rendered on the server for the first HTML, so importing
 * it directly threw there and Next fell back to client rendering — the page
 * worked, and reported an error every time it was opened.
 *
 * `ssr: false` is only allowed from a client component, which is why this thin
 * wrapper exists rather than the option being passed at the call site.
 */
const PdfViewerClient = dynamic(
  () => import("./pdf-viewer-client").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[68vh] min-h-96 items-center justify-center rounded-xl border border-border bg-muted/30">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

export function PdfViewer(props: {
  url: string;
  title: string;
  className?: string;
}) {
  return <PdfViewerClient {...props} />;
}
