"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload } from "lucide-react";
import type { DocumentDto } from "@peoplepay360/shared";

import { Button, Field, FieldError, FieldLabel } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { fileSize } from "@/lib/format";
import { FORM_IDLE, type FormState } from "@/lib/form-state";

import { submitDocument } from "@/app/(app)/documents/actions";

/** Where an employee answers a request for a document. */
export function SubmitRequestedPanel({ document }: { document: DocumentDto }) {
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [state, setState] = React.useState<FormState>(FORM_IDLE);
  const [pending, startTransition] = React.useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await submitDocument(FORM_IDLE, form);
      setState(next);
      if (!next.ok) return;
      toast(next.message ?? "Sent.");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <input type="hidden" name="id" value={document.id} />

      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Upload className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">Send this document</h2>
      </div>
      <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
        {document.createdBy.name} asked for it. Only they and your HR team will
        see what you upload.
      </p>

      <Field>
        <FieldLabel htmlFor="submit-file">File</FieldLabel>
        <label
          htmlFor="submit-file"
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input px-4 py-5 transition-colors hover:bg-muted/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Paperclip className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            {file ? (
              <>
                <span className="block truncate text-sm font-medium">
                  {file.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {fileSize(file.size)} · tap to replace
                </span>
              </>
            ) : (
              <>
                <span className="block text-sm font-medium">Choose a file</span>
                <span className="block text-xs text-muted-foreground">
                  A photo of it is fine
                </span>
              </>
            )}
          </span>
        </label>
        <input
          id="submit-file"
          name="file"
          type="file"
          // A phone camera is the likeliest source for a passport or a
          // certificate, so it is offered rather than only the file browser.
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <FieldError message={state.fieldErrors?.file} />
      </Field>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="md"
        fullWidth
        className="mt-5"
        loading={pending}
        loadingText="Sending"
        disabled={!file}
        startIcon={<Upload />}
      >
        Send it
      </Button>
    </form>
  );
}
