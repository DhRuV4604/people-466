"use client";

import * as React from "react";
import { FileUp, Paperclip, Send, Plus, Sparkles } from "lucide-react";
import { DOCUMENT_KINDS, type DocumentKind } from "@peoplepay360/shared";

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
  Input,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { DOCUMENT_KIND_LABELS, fileSize } from "@/lib/format";
import type { FieldOption } from "@/lib/fields";
import { FORM_IDLE, type FormState } from "@/lib/form-state";

import { analyseDocument, requestDocument, uploadDocument } from "../actions";

const KIND_OPTIONS = DOCUMENT_KINDS.map((kind) => ({
  value: kind,
  label: DOCUMENT_KIND_LABELS[kind as DocumentKind],
}));

/**
 * Select is built on the animated menu rather than a native `<select>`, so it
 * submits nothing on its own. It keeps its value in state and posts it through
 * a hidden input, which is how the record form does it too.
 */
function SelectField({
  id,
  name,
  label,
  options,
  defaultValue = "",
  placeholder,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input type="hidden" name={name} value={value} />
      <Select
        id={id}
        size="md"
        options={options}
        value={value}
        onValueChange={setValue}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Field>
  );
}

/**
 * The file input.
 *
 * A bare `<input type="file">` cannot be styled and says "No file chosen" in
 * the browser's own words, so the real input is hidden behind a label and what
 * is shown is the file that was picked.
 */
function FilePicker({
  name,
  accept,
  error,
  onPicked,
}: {
  name: string;
  accept?: string;
  error?: string;
  onPicked?: (file: File | null) => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const id = `${name}-input`;

  return (
    <Field>
      <FieldLabel htmlFor={id}>Document</FieldLabel>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input px-4 py-5 transition-colors hover:bg-muted/40"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Paperclip className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          {file ? (
            <>
              <span className="block truncate text-sm font-medium">
                {file.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {fileSize(file.size)} · click to replace
              </span>
            </>
          ) : (
            <>
              <span className="block text-sm font-medium">Choose a file</span>
              <span className="block text-xs text-muted-foreground">
                PDF, image or Word document, up to 20 MB
              </span>
            </>
          )}
        </span>
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0] ?? null;
          setFile(picked);
          onPicked?.(picked);
        }}
      />
      <FieldError message={error} />
    </Field>
  );
}

/** Upload something into an employee's file, optionally for signature. */
export function UploadDocumentDialog({
  employees,
  employeeId,
}: {
  employees: FieldOption[];
  /** Fixed when opened from one person's record. */
  employeeId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<FormState>(FORM_IDLE);
  const [pending, startTransition] = React.useTransition();
  const [forSignature, setForSignature] = React.useState(false);
  const [isPdf, setIsPdf] = React.useState(true);
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState("JOINING_LETTER");
  const [summary, setSummary] = React.useState("");
  const [reading, setReading] = React.useState(false);
  const { toast } = useToast();

  /**
   * Has the model read the chosen file and fill the form in.
   *
   * It fills the fields rather than submitting them: this is a reading of a
   * document nobody here wrote, and the person uploading it is the one who
   * knows whether it is right.
   */
  const readFile = () => {
    if (!file) return;
    setReading(true);
    startTransition(async () => {
      const body = new FormData();
      body.set("file", file);
      const next = await analyseDocument(FORM_IDLE, body);
      setReading(false);
      if (!next.ok || !next.record) {
        toast(next.error ?? "Could not read that file.", "error");
        return;
      }
      setTitle(next.record.title);
      setKind(next.record.kind);
      setForSignature(next.record.needsSignature);
      setSummary(next.record.summary);
    });
  };

  // The result is acted on where it arrives rather than watched for in an
  // effect: closing the dialog is a consequence of the submit, not of the
  // state having changed.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await uploadDocument(FORM_IDLE, form);
      setState(next);
      if (!next.ok) return;
      setOpen(false);
      if (next.message) toast(next.message);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button startIcon={<Plus />} size="md">
          Add document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>
            Goes into the employee&apos;s file. Ask for a signature and they are
            told it is waiting on them.
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

          <FilePicker
            name="file"
            error={state.fieldErrors?.file}
            onPicked={(picked) => {
              setFile(picked);
              setIsPdf(!picked || picked.type === "application/pdf");
              setSummary("");
            }}
          />

          {file && isPdf ? (
            <div className="-mt-2 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                startIcon={<Sparkles />}
                loading={reading}
                loadingText="Reading"
                onClick={readFile}
              >
                Read it and fill this in
              </Button>
              {summary ? (
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {summary}
                </p>
              ) : null}
            </div>
          ) : null}

          <Field>
            <FieldLabel htmlFor="title">Name</FieldLabel>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Joining letter"
              disabled={pending}
            />
            <FieldError message={state.fieldErrors?.title} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="kind">Type</FieldLabel>
              <input type="hidden" name="kind" value={kind} />
              <Select
                id="kind"
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
              <SelectField
                id="employeeId"
                name="employeeId"
                label="Employee"
                options={employees}
                placeholder="Choose someone"
                disabled={pending}
              />
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="message">Message</FieldLabel>
            <Textarea
              id="message"
              name="message"
              rows={3}
              placeholder="Please read and sign to complete your onboarding."
              disabled={pending}
            />
          </Field>

          <Field>
            <div className="flex items-start justify-between gap-4">
              <div>
                <FieldLabel htmlFor="requiresSignature">
                  Ask for a signature
                </FieldLabel>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPdf
                    ? "They sign it here, and a certificate page is added recording who signed and when."
                    : "Only a PDF can be signed. Convert the file to ask for one."}
                </p>
              </div>
              {forSignature && isPdf ? (
                <input type="hidden" name="requiresSignature" value="true" />
              ) : null}
              <Switch
                id="requiresSignature"
                checked={forSignature && isPdf}
                onCheckedChange={setForSignature}
                disabled={!isPdf || pending}
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
              loadingText="Uploading"
              startIcon={<FileUp />}
            >
              {forSignature && isPdf ? "Send for signature" : "Add to file"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ask an employee to supply something. Nothing is attached yet. */
export function RequestDocumentDialog({
  employees,
  employeeId,
}: {
  employees: FieldOption[];
  employeeId?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<FormState>(FORM_IDLE);
  const [pending, startTransition] = React.useTransition();
  const { toast } = useToast();

  // The result is acted on where it arrives rather than watched for in an
  // effect: closing the dialog is a consequence of the submit, not of the
  // state having changed.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await requestDocument(FORM_IDLE, form);
      setState(next);
      if (!next.ok) return;
      setOpen(false);
      if (next.message) toast(next.message);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="md" startIcon={<Send />}>
          Ask for a document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask for a document</DialogTitle>
          <DialogDescription>
            They will see it in their documents with somewhere to upload it.
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
            <FieldLabel htmlFor="request-title">What do you need?</FieldLabel>
            <Input
              id="request-title"
              name="title"
              placeholder="Passport scan"
              disabled={pending}
            />
            <FieldError message={state.fieldErrors?.title} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              id="request-kind"
              name="kind"
              label="Type"
              options={KIND_OPTIONS}
              defaultValue="ID_PROOF"
              disabled={pending}
            />

            {employeeId ? (
              <input type="hidden" name="employeeId" value={employeeId} />
            ) : (
              <SelectField
                id="request-employee"
                name="employeeId"
                label="Employee"
                options={employees}
                placeholder="Choose someone"
                disabled={pending}
              />
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="request-message">Message</FieldLabel>
            <Textarea
              id="request-message"
              name="message"
              rows={3}
              placeholder="For your personnel file."
              disabled={pending}
            />
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
              loadingText="Asking"
              startIcon={<Send />}
            >
              Ask for it
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
