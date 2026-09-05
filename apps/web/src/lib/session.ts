import { cookies } from 'next/headers';
import type { AuthUser, LoginResponse } from '@peoplepay360/shared';
import { apiFetch, ApiError, SESSION_COOKIE } from './api-client';

const USER_COOKIE = 'pp360_user';

/**
 * Session handling.
 *
 * The API issues the JWT; the web app stores it in an httpOnly cookie so it is
 * never readable from client-side JavaScript. A second, non-sensitive cookie
 * caches the user's display name and role so navigation can render without an
 * extra round trip - the API remains the authority on what that role may do.
 */

export async function login(email: string, password: string): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  });

  const store = await cookies();
  const secure = process.env.NODE_ENV === 'production';

  store.set(SESSION_COOKIE, result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  store.set(USER_COOKIE, JSON.stringify(result.user), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

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
 * Verify the session against the API. Use where a stale role would matter, such
 * as before rendering an admin-only screen.
 */
export async function verifySession(): Promise<AuthUser | null> {
  try {
    return await apiFetch<AuthUser>('/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
