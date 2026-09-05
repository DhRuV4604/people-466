"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PenLine, X } from "lucide-react";
import type { DocumentDto } from "@peoplepay360/shared";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";

import { SignaturePad } from "./signature-pad";
import { declineDocument, signDocument } from "@/app/(app)/documents/actions";

/**
 * Where a document gets signed.
 *
 * Signing is not a form post: the signature is produced in the browser as a
 * PNG, so the action is called directly with it rather than routed through
 * FormData that would only have to carry the same string.
 */
export function SignPanel({ document }: { document: DocumentDto }) {
  const router = useRouter();
  const { toast } = useToast();
  const [signature, setSignature] = React.useState("");
  const [typedName, setTypedName] = React.useState("");
  const [declining, setDeclining] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    startTransition(async () => {
      const state = await signDocument(document.id, signature, typedName);
      if (state.ok) {
        toast(state.message ?? "Signed.");
        router.refresh();
      } else {
        toast(state.error ?? "That didn't work.", "error");
      }
    });
  };

  const refuse = () => {
    startTransition(async () => {
      const state = await declineDocument(document.id, reason);
      if (state.ok) {
        toast(state.message ?? "Declined.");
        setDeclining(false);
        router.refresh();
      } else {
        toast(state.error ?? "That didn't work.", "error");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PenLine className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">Sign this document</h2>
      </div>
      <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
        Read it first. Signing records your name, the time, and the device you
        signed from on a certificate page added to the document.
      </p>

      <div className="flex flex-col gap-5">
        <SignaturePad
          value={signature}
          onChange={setSignature}
          disabled={pending}
        />

        <Field>
          <FieldLabel htmlFor="typedName">
            Type your name to confirm
          </FieldLabel>
          <Input
            id="typedName"
            value={typedName}
            disabled={pending}
            placeholder="Your full name"
            onChange={(event) => setTypedName(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            It has to match the name on the document.
          </p>
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="md"
            startIcon={<X />}
            disabled={pending}
            onClick={() => setDeclining(true)}
          >
            Decline
          </Button>
          <Button
            type="button"
            size="md"
            loading={pending}
            loadingText="Signing"
            startIcon={<CheckCircle2 />}
            disabled={!signature || !typedName.trim()}
            onClick={submit}
          >
            Sign and submit
          </Button>
        </div>
      </div>

      {/* The reason is the point of declining, so it is asked for in the same
          box as the confirmation rather than after it. */}
      <Dialog open={declining} onOpenChange={setDeclining}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline {document.title}?</DialogTitle>
            <DialogDescription>
              Whoever sent it will be told, along with your reason. Nothing
              reopens a declined document, so it would have to be sent again.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="declineReason">Why?</FieldLabel>
            <Textarea
              id="declineReason"
              rows={3}
              value={reason}
              disabled={pending}
              onChange={(event) => setReason(event.target.value)}
              placeholder="The start date is wrong."
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setDeclining(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="md"
              loading={pending}
              loadingText="Declining"
              disabled={reason.trim().length < 3}
              onClick={refuse}
            >
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
