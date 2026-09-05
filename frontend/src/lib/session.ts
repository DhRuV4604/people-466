import { cookies } from "next/headers";
import type { AuthUser, LoginResponse } from "@peoplepay360/shared";

import { ApiError, SESSION_COOKIE, apiFetch } from "@/lib/api-client";

const USER_COOKIE = "pp360_user";
const MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Session handling.
 *
 * The API issues the JWT; this app stores it in an httpOnly cookie so it is
 * never readable from client-side JavaScript. A second cookie caches the
 * user's name and role so navigation can render without an extra round trip.
 * The API remains the authority on what that role may actually do.
 */

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    anonymous: true,
  });

  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: MAX_AGE,
  };

  store.set(SESSION_COOKIE, result.accessToken, options);
  store.set(USER_COOKIE, JSON.stringify(result.user), options);

  return result;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(USER_COOKIE);
}

/** Cached identity for rendering. Returns null when signed out. */
export async function getSession(): Promise<AuthUser | null> {
  const store = await cookies();
  const raw = store.get(USER_COOKIE)?.value;
  const token = store.get(SESSION_COOKIE)?.value;

  if (!raw || !token) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Verify the session against the API. Use where a stale role would matter,
 * such as before rendering a screen only some roles may see.
 */
export async function verifySession(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>("/auth/me", { allowUnauthorized: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/**
 * Re-reads the account from the API and rewrites the cached cookie.
 *
 * Used after something changes about the account itself rather than about a
 * record — changing a password clears `mustChangePassword`, and the cookie
 * would otherwise keep sending the person back to change it again.
 */
export async function refreshSession(): Promise<AuthUser | null> {
  const current = await verifySession();
  if (!current) return null;

  const store = await cookies();
  const existing = store.get(SESSION_COOKIE);
  if (!existing) return null;

  store.set(USER_COOKIE, JSON.stringify(current), {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return current;
}
