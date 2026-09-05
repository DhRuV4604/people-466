"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { FORM_IDLE } from "@/lib/form-state";

import { removeLogo, uploadLogo } from "../actions";

/**
 * The company logo.
 *
 * Shown at the size it is actually used - small, in a header band - rather than
 * blown up to fill a panel, because the only question worth answering here is
 * whether it reads at that size.
 */
export function LogoPicker({ logoFileId }: { logoFileId: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const run = (work: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const state = await work();
      if (state.ok) {
        toast(state.message ?? "Done.");
        router.refresh();
      } else {
        toast(state.error ?? "That didn't work.", "error");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40">
        {logoFileId ? (
          // eslint-disable-next-line @next/next/no-img-element -- the API
          // streams this behind a session; next/image cannot fetch it.
          <img
            // The id changes with every upload, which is what makes a replaced
            // logo appear immediately instead of showing the cached one.
            src={`/api/company/logo?v=${logoFileId}`}
            alt="Company logo"
            className="size-full object-contain p-2"
          />
        ) : (
          <ImageUp className="size-6 text-muted-foreground" />
        )}
      </span>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={pending}
            loadingText="Uploading"
            startIcon={<ImageUp />}
            onClick={() => inputRef.current?.click()}
          >
            {logoFileId ? "Replace" : "Upload a logo"}
          </Button>

          {logoFileId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              startIcon={<Trash2 />}
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG or WebP, up to 5 MB. It goes on payslip headers and on
          generated letters.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const body = new FormData();
          body.set("file", file);
          run(() => uploadLogo(FORM_IDLE, body));
          // Cleared so choosing the same file twice still fires a change.
          event.target.value = "";
        }}
      />

      {confirming ? (
        <ConfirmDialog
          defaultOpen
          onOpenChange={setConfirming}
          title="Remove the logo?"
          description="Payslips and letters go back to showing the company name alone. Documents already generated keep the logo they were made with."
          confirmLabel="Remove"
          destructive
          onConfirm={() => run(removeLogo)}
        />
      ) : null}
    </div>
  );
}
