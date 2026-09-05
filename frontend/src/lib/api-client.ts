import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server-side HTTP client for the PeoplePay360 API.
 *
 * Every call runs on the Next.js server, which reads the session cookie and
 * forwards it as a bearer token. The token therefore never reaches the
 * browser, which is why it lives in an httpOnly cookie rather than
 * localStorage.
 */

export const SESSION_COOKIE = "pp360_token";

/**
 * Server-to-server calls use the internal address (the compose service name in
 * Docker); browser-facing configuration uses the public one.
 */
function baseUrl(): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"
  );
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Skip attaching the bearer token, for login and other public routes. */
  anonymous?: boolean;
  /** Return null instead of throwing when the API responds 404. */
  nullOn404?: boolean;
  /**
   * Hand a 401 back to the caller instead of clearing the session.
   *
   * Only for the calls whose whole job is to find out whether the session is
   * still good: they have to see the refusal, not be redirected by it.
   */
  allowUnauthorized?: boolean;
  /**
   * Bearer token supplied by the caller instead of read from the cookie store.
   *
   * `cookies()` may only be called in request scope, so anything running inside
   * `unstable_cache` has to be handed its token rather than reading one.
   */
  token?: string | null;
  /**
   * Passed through to fetch. Defaults to "no-store": most calls are per-request
   * data behind a session. Reference lists override it.
   */
  cache?: RequestCache;
  /** Seconds before a cached response is refetched. Implies a cache mode. */
  revalidate?: number;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(
    `/api${path.startsWith("/") ? path : `/${path}`}`,
    baseUrl(),
  );

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
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

/** Reads the message the API sent, falling back to the status text. */
function readError(payload: unknown, status: number, statusText: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) {
      return { message: String(message[0]), details: message.map(String) };
    }
    if (typeof message === "string") return { message, details: undefined };
  }
  return { message: statusText || `Request failed (${status})`, details: undefined };
}

/** Core request helper. Throws ApiError on any non-2xx response. */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    anonymous,
    nullOn404,
    allowUnauthorized,
    token: explicitToken,
    cache,
    revalidate,
  } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!anonymous) {
    const token = explicitToken !== undefined ? explicitToken : await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(revalidate !== undefined
        ? { next: { revalidate } }
        : { cache: cache ?? "no-store" }),
    });
  } catch {
    // The API being down is an expected condition in local development, so it
    // surfaces as an ApiError the caller can render rather than a crash.
    throw new ApiError(503, "Cannot reach the API. Is it running?");
  }

  // A rejected token cannot be recovered from by retrying, and every page on
  // the way to rendering would fail the same way. Clearing it and asking for a
  // sign-in is the only useful response.
  if (response.status === 401 && !anonymous && !allowUnauthorized) {
    redirect("/signed-out");
  }

  if (response.status === 404 && nullOn404) return null as T;
  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const { message, details } = readError(
      payload,
      response.status,
      response.statusText,
    );
    throw new ApiError(response.status, message, details);
  }

  return payload as T;
}

/**
 * Uploads a file.
 *
 * Separate from `apiFetch` because a multipart body is the one thing it cannot
 * carry: it sets a JSON content type and serialises what it is given, and
 * `FormData` needs fetch to write its own boundary header instead.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const token = await getToken();

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, "Cannot reach the API. Is it running?");
  }

  if (response.status === 401) redirect("/signed-out");
  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const { message, details } = readError(
      payload,
      response.status,
      response.statusText,
    );
    throw new ApiError(response.status, message, details);
  }

  return payload as T;
}
