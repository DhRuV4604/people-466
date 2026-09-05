"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  DOCUMENT_KINDS,
  type DocumentDto,
  type DocumentKind,
} from "@peoplepay360/shared";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldError,
  FieldLabel,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { FieldOption } from "@/lib/fields";
import { DOCUMENT_KIND_LABELS } from "@/lib/format";
import { FORM_IDLE, type FormState } from "@/lib/form-state";

import { draftDocument } from "../actions";

/** The kinds worth generating. Nobody wants a passport scan written for them. */
const WRITABLE: DocumentKind[] = [
  "JOINING_LETTER",
  "OFFER_LETTER",
  "NDA",
  "CONTRACT",
  "POLICY",
];

const KIND_OPTIONS = DOCUMENT_KINDS.filter((kind) =>
  WRITABLE.includes(kind),
).map((kind) => ({ value: kind, label: DOCUMENT_KIND_LABELS[kind] }));

export function DraftDocumentDialog({
  employees,
  employeeId,
}: {
  employees: FieldOption[];
  employeeId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<FormState<DocumentDto>>(FORM_IDLE);
  const [pending, startTransition] = React.useTransition();

  const [kind, setKind] = React.useState<string>("JOINING_LETTER");
  const [who, setWho] = React.useState(employeeId ?? "");
  const [forSignature, setForSignature] = React.useState(true);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await draftDocument(FORM_IDLE, form);
      setState(next);
      if (!next.ok) return;
      setOpen(false);
      toast(next.message ?? "Written.");
      // Straight to the draft, because the whole point is that somebody reads
      // it before it goes anywhere.
      const id = next.id ?? next.record?.id;
      if (id) router.push(`/documents/${id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="md" startIcon={<Sparkles />}>
          Write with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Write with AI</DialogTitle>
          <DialogDescription>
            Drafted from what this system already knows about the person. It is
            filed as a draft so you can read it before anyone else does.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {state.error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <Field>
            <FieldLabel htmlFor="draft-kind">What should it write?</FieldLabel>
            <input type="hidden" name="kind" value={kind} />
            <Select
              id="draft-kind"
              size="md"
              options={KIND_OPTIONS}
              value={kind}
              onValueChange={setKind}
              disabled={pending}
            />
          </Field>

          {employeeId ? (
            <input type="hidden" name="employeeId" value={employeeId} />
          ) : (
            <Field>
              <FieldLabel htmlFor="draft-employee">Who is it for?</FieldLabel>
              <input type="hidden" name="employeeId" value={who} />
              <Select
                id="draft-employee"
                size="md"
                options={employees}
                value={who}
                onValueChange={setWho}
                placeholder="Choose someone"
                disabled={pending}
              />
              <FieldError message={state.fieldErrors?.employeeId} />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="draft-notes">
              Anything it should say?
            </FieldLabel>
            <Textarea
              id="draft-notes"
              name="notes"
              rows={3}
              disabled={pending}
              placeholder="Mention the six month probation, and that the role is hybrid."
            />
            <p className="text-xs text-muted-foreground">
              Job title, department, start date and employee code are taken from
              their record. Salary is never included.
            </p>
          </Field>

          <Field>
            <div className="flex items-start justify-between gap-4">
              <div>
                <FieldLabel htmlFor="draft-sign">
                  Ask for a signature when sent
                </FieldLabel>
                <p className="mt-1 text-xs text-muted-foreground">
                  You can change this before sending.
                </p>
              </div>
              {forSignature ? (
                <input type="hidden" name="requiresSignature" value="true" />
              ) : null}
              <Switch
                id="draft-sign"
                checked={forSignature}
                onCheckedChange={setForSignature}
                disabled={pending}
              />
            </div>
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="md"
              loading={pending}
              loadingText="Writing"
              startIcon={<Sparkles />}
            >
              Write it
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
