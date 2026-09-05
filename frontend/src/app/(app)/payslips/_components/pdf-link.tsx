import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui";

/**
 * The payslip PDF is a link rather than a button because the browser fetches
 * the file itself; the route attaches the session token on the way through. It
 * borrows the library's own variants so it cannot drift from the real buttons
 * standing next to it.
 */
export function PdfLink({
  id,
  label,
}: {
  id: string;
  /** Omit for the icon-only form, which is what a table row has space for. */
  label?: string;
}) {
  return (
    <a
      href={`/api/payslips/${id}/pdf`}
      // The API serves the file inline, so in the same tab it would replace
      // the app with a PDF viewer and lose the list behind it.
      target="_blank"
      rel="noopener noreferrer"
      title={label ? undefined : "Open PDF"}
      aria-label={label ? undefined : "Open PDF"}
      className={buttonVariants(
        label
          ? { variant: "outline", size: "md" }
          : { variant: "ghost", size: "icon-sm" },
      )}
    >
      <Download />
      {label}
    </a>
  );
}
