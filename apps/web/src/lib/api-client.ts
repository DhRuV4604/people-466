import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Server-side HTTP client for the PeoplePay360 API.
 *
 * Every call runs on the Next.js server, which reads the session cookie and
 * forwards it as a bearer token. The token therefore never reaches the browser,
 * which is why it is stored in an httpOnly cookie rather than localStorage.
 */

export const SESSION_COOKIE = 'pp360_token';

/**
 * Server-to-server calls use the internal address (the compose service name in
 * Docker); browser calls use the public one.
 */
function baseUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Skip attaching the bearer token, for login and other public routes. */
  anonymous?: boolean;
  /** Return null instead of throwing when the API responds 404. */
  nullOn404?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`/api${path.startsWith('/') ? path : `/${path}`}`, baseUrl());
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function getToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Core request helper. Throws ApiError on any non-2xx response. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, anonymous, nullOn404 } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (!anonymous) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    // HR data changes constantly, so never serve a cached page body.
    cache: 'no-store',
  });

  if (response.status === 404 && nullOn404) return null as T;

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let details: string[] | undefined;

    try {
      const errorBody = await response.json();
      if (Array.isArray(errorBody.message)) {
        details = errorBody.message;
        message = errorBody.message.join(' ');
      } else if (typeof errorBody.message === 'string') {
        message = errorBody.message;
      }
    } catch {
      // A non-JSON error body leaves the default message in place.
    }

    throw new ApiError(response.status, message, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Fetch for a page render: an expired or missing session sends the user to the
 * login screen instead of surfacing a raw 401.
 */
export async function apiGet<T>(
  path: string,
  query?: RequestOptions['query']
): Promise<T> {
  try {
    return await apiFetch<T>(path, { query });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }
}

/** Like apiGet, but a 403 sends the user somewhere they are allowed to be. */
export async function apiGetOrRedirect<T>(
  path: string,
  fallbackPath: string,
  query?: RequestOptions['query']
): Promise<T> {
  try {
    return await apiFetch<T>(path, { query });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.status === 403) redirect(fallbackPath);
    throw err;
  }
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => apiFetch<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Payslip PDF link. Points at a local proxy route rather than the API directly,
 * because the browser cannot attach the bearer token to a plain link - the
 * proxy reads the httpOnly cookie and forwards it.
 */
export function payslipPdfUrl(payslipId: string): string {
  return `/api/payslips/${payslipId}/pdf`;
}
