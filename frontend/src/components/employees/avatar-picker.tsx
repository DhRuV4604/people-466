"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/profile";
import { useToast } from "@/components/ui/toast";
import { avatarUrl } from "@/lib/avatar";

import { uploadAvatar } from "@/app/(app)/employees/actions";

/**
 * A profile picture, and the one control that changes it.
 *
 * Deliberately not a dialog: this is one field with one action, and putting it
 * behind a modal would be more ceremony than choosing a photo deserves.
 */
export function AvatarPicker({
  employeeId,
  name,
  avatarFileId,
  size = "lg",
}: {
  employeeId: string;
  name: string;
  avatarFileId: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex items-center gap-4">
      <UserAvatar
        name={name}
        size={size}
        src={avatarUrl(employeeId, avatarFileId)}
      />

      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={pending}
          loadingText="Uploading"
          startIcon={<Camera />}
          onClick={() => inputRef.current?.click()}
        >
          {avatarFileId ? "Change picture" : "Add a picture"}
        </Button>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG or WebP, up to 5 MB.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        // A phone camera is the obvious source for a profile picture.
        capture="user"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const body = new FormData();
          body.set("file", file);
          startTransition(async () => {
            const state = await uploadAvatar(employeeId, body);
            if (state.ok) {
              toast(state.message ?? "Picture updated.");
              router.refresh();
            } else {
              toast(state.error ?? "That didn't work.", "error");
            }
          });
          event.target.value = "";
        }}
      />
    </div>
  );
}
