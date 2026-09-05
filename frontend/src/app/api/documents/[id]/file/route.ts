import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/api-client";

/**
 * Streams a document from the API.
 *
 * The browser cannot call the API directly for this: the bearer token lives in
 * an httpOnly cookie and never reaches client-side JavaScript. So the request
 * goes through the Next server, which attaches the token and passes the file
 * back. The API still enforces who may read the document.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // "signed" is the default the API applies too: it is the copy carrying the
  // certificate, and the one anybody asking for the document means.
  const version =
    new URL(request.url).searchParams.get("version") === "original"
      ? "original"
      : "signed";
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }

  const base =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";

  const upstream = await fetch(`${base}/api/documents/${id}/file?version=${version}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { message: "Could not fetch that document." },
      { status: upstream.status || 502 },
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/pdf",
      // Keep the filename the API chose, so downloads are named consistently.
      "Content-Disposition":
        upstream.headers.get("content-disposition") ??
        `inline; filename="document-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
