import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/api-client";

/**
 * Streams an employee’s profile picture from the API.
 *
 * Same reason as the payslip route: the bearer token lives in an httpOnly
 * cookie the browser cannot read, so an `<img src>` has to come through the
 * Next server, which attaches it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }

  const base =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";

  const upstream = await fetch(`${base}/api/employees/${id}/avatar`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ message: "No picture." }, { status: upstream.status || 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      // The caller appends the file id, so a replaced logo is a new URL.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
