import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/api-client";

/**
 * Proxies the API's notification event stream to the browser.
 *
 * `EventSource` cannot set an Authorization header, and the bearer token lives
 * in an httpOnly cookie that client-side JavaScript never sees. So the browser
 * subscribes here, the Next server attaches the token, and the upstream stream
 * is piped straight back. The API still decides whose notifications these are.
 */
export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }

  const base =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "text/event-stream",
  };

  // EventSource replays its last id when it reconnects. Forwarding it lets the
  // API resume from there rather than repeat or drop what was missed.
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId) headers["Last-Event-ID"] = lastEventId;

  // Tying the upstream request to the browser's means closing the tab closes
  // the API connection too, instead of leaving a stream open per abandoned tab.
  const upstream = await fetch(`${base}/api/notifications/stream`, {
    headers,
    cache: "no-store",
    signal: request.signal,
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json(
      { message: "Could not open the notification stream." },
      { status: upstream?.status || 502 },
    );
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // Nothing may sit on this response. `no-transform` keeps compressors off
      // it — a compressor would hold events back until its window filled — and
      // `X-Accel-Buffering` says the same thing to an nginx in front.
      "Cache-Control": "private, no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
