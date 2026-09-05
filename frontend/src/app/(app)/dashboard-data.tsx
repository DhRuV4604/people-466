import { cache } from "react";
import type { DashboardDto } from "@peoplepay360/shared";

import { apiFetch } from "@/lib/api-client";

/**
 * The overview is rendered as several independent Suspense boundaries, each of
 * which needs the same payload. `cache` dedupes them to one request per render
 * so splitting the page for streaming does not multiply the API calls.
 */
export const getDashboard = cache(
  async (): Promise<DashboardDto> => apiFetch<DashboardDto>("/dashboard"),
);
