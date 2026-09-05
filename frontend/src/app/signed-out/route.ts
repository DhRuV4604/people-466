import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/api-client";

/**
 * Where a dead session is sent to be cleared.
 *
 * A server component cannot write cookies, so a page that discovers its token
 * is no longer good has nowhere to put that knowledge. A route handler can,
 * which is why this exists as a redirect target rather than a function: it
 * throws away both cookies and hands the visitor to the sign-in screen, so the
 * next request starts clean instead of failing the same way again.
 */
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete("pp360_user");
  return response;
}
