"use server";

import { callAction, type FormState } from "@/lib/mutate";

/**
 * The two writes the bell makes. They live beside the layout that mounts it
 * rather than under a screen folder, because notifications have no screen of
 * their own.
 */

export async function markNotificationRead(id: string): Promise<FormState> {
  return callAction({
    path: `/notifications/${id}/read`,
    message: "Marked as read.",
  });
}

export async function markAllNotificationsRead(): Promise<FormState> {
  return callAction({
    path: "/notifications/read-all",
    message: "All notifications marked as read.",
  });
}
