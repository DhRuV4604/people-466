import type { NotificationSummaryDto } from "@peoplepay360/shared";

import { NotificationBell } from "@/components/app/notification-bell";
import { apiFetch } from "@/lib/api-client";

const EMPTY: NotificationSummaryDto = { unread: 0, items: [] };

/**
 * Loads the bell's first page on the server, so the count is already right in
 * the first paint rather than appearing a round trip later. The bell itself is
 * a client component because it holds a live connection; this is the only part
 * that can read the session cookie.
 *
 * It fails soft on purpose. This sits in the shell of every screen, and a
 * header that throws takes the whole app down with it — an empty bell is the
 * smaller problem when the API is unreachable.
 */
export async function Notifications() {
  let summary = EMPTY;

  try {
    summary = await apiFetch<NotificationSummaryDto>("/notifications", {
      query: { limit: 12 },
    });
  } catch {
    // Nothing to report: a header has nowhere to put an error message.
  }

  return <NotificationBell initial={summary} />;
}
