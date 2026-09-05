"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CalendarOff,
  Check,
  ChevronRight,
  FileSignature,
  FileWarning,
  Send,
  Wallet,
  X,
} from "lucide-react";
import type {
  DashboardTask,
  DashboardTaskKind,
  DashboardTaskSubject,
} from "@peoplepay360/shared";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from "@/components/ui";
import { UserAvatar } from "@/components/ui/profile";
import { buttonVariants } from "@/components/ui/button-variants";
import { avatarUrl } from "@/lib/avatar";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

import {
  approveLeaveTask,
  refuseLeaveTask,
  saveBankDetailsTask,
  sendInviteTask,
} from "../actions";

/**
 * How each kind of task presents itself, and what finishing it looks like.
 *
 * `resolve` is the verb that can be done here; `href` is where the work has to
 * continue when it cannot. Not everything belongs in a dialog — computing a pay
 * run is a screen, not a button — and pretending otherwise would put a control
 * in front of someone that only navigates away.
 */
const TASKS: Record<
  DashboardTaskKind,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Said in the card. Given the month the dashboard is describing. */
    blurb: (period: string) => string;
    tone: "urgent" | "warn" | "info";
    action: string;
    href?: (subject: DashboardTaskSubject) => string;
  }
> = {
  PENDING_LEAVE: {
    label: "Leave to approve",
    icon: CalendarOff,
    blurb: () => "Someone is waiting on an answer",
    tone: "urgent",
    action: "Review",
  },
  MISSING_BANK: {
    label: "Missing bank details",
    icon: Banknote,
    blurb: () => "Payroll cannot pay them",
    tone: "urgent",
    action: "Add details",
  },
  NO_CONTRACT: {
    label: "No contract",
    icon: FileWarning,
    blurb: (period) => `No running contract covering ${period}`,
    tone: "urgent",
    action: "Open record",
    href: (s) => `/employees/${s.id}/contracts`,
  },
  NEVER_INVITED: {
    label: "Never invited",
    icon: Send,
    blurb: () => "They cannot sign in yet",
    tone: "warn",
    action: "Send invite",
  },
  AWAITING_SIGNATURE: {
    label: "Awaiting signature",
    icon: FileSignature,
    blurb: () => "Sent, not signed",
    tone: "warn",
    action: "Open",
    href: (s) => `/documents/${s.id}`,
  },
  DRAFT_PAYRUN: {
    label: "Pay run not finished",
    icon: Wallet,
    blurb: () => "Still a draft",
    tone: "warn",
    action: "Open",
    href: (s) => `/payruns/${s.id}`,
  },
  EXPIRING_CONTRACT: {
    label: "Contracts expiring",
    icon: CalendarClock,
    blurb: () => "Ending within 30 days",
    tone: "info",
    action: "Open",
    href: (s) => `/contracts?q=${encodeURIComponent(s.name)}`,
  },
  MISSING_CHECKOUT: {
    label: "No check-out",
    icon: AlertTriangle,
    blurb: (period) => `Open shifts in ${period}`,
    tone: "info",
    action: "Open",
    href: () => `/attendance?status=MISSING_CHECKOUT`,
  },
};

/**
 * Kinds where a face means something.
 *
 * Not always the subject itself: a document waiting to be signed is a document,
 * but the card is really about the person who has not signed it. A pay run is
 * the one thing here with nobody behind it.
 */
const PEOPLE_TASKS = new Set<DashboardTaskKind>([
  'PENDING_LEAVE',
  'MISSING_BANK',
  'NO_CONTRACT',
  'NEVER_INVITED',
  'EXPIRING_CONTRACT',
  'MISSING_CHECKOUT',
  'AWAITING_SIGNATURE',
]);

const TONES = {
  urgent: "bg-destructive/10 text-destructive",
  warn: "bg-primary/10 text-primary",
  info: "bg-muted text-muted-foreground",
} as const;

const ACCENTS = {
  urgent: "bg-destructive",
  warn: "bg-primary",
  info: "bg-border",
} as const;

/** Runs an action and reports it, so every row behaves the same way. */
function useTaskAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const run = React.useCallback(
    (work: () => Promise<FormState>, onDone?: () => void) => {
      startTransition(async () => {
        const state = await work();
        if (state.ok) {
          toast(state.message ?? "Done.");
          onDone?.();
          router.refresh();
        } else {
          toast(state.error ?? "That didn't work.", "error");
        }
      });
    },
    [router, toast],
  );

  return { run, pending };
}

/** Bank details, asked for and saved without leaving the dashboard. */
function BankRow({ subject }: { subject: DashboardTaskSubject }) {
  const { run, pending } = useTaskAction();
  const [open, setOpen] = React.useState(false);
  const [bankName, setBankName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Add details
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bank details for {subject.name}</DialogTitle>
            <DialogDescription>
              Payroll refuses to pay an employee without these, so a pay run
              will skip them until both are filled in.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor={`bank-${subject.id}`}>Bank</FieldLabel>
              <Input
                id={`bank-${subject.id}`}
                value={bankName}
                disabled={pending}
                placeholder="HDFC Bank"
                onChange={(event) => setBankName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`acct-${subject.id}`}>
                Account number
              </FieldLabel>
              <Input
                id={`acct-${subject.id}`}
                value={accountNumber}
                disabled={pending}
                onChange={(event) => setAccountNumber(event.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="md"
                loading={pending}
                loadingText="Saving"
                disabled={!bankName.trim() || !accountNumber.trim()}
                onClick={() =>
                  run(
                    () =>
                      saveBankDetailsTask(subject.id, bankName, accountNumber),
                    () => setOpen(false),
                  )
                }
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Approve or refuse, with the reason asked for in the same box. */
function LeaveRow({ subject }: { subject: DashboardTaskSubject }) {
  const { run, pending } = useTaskAction();
  const [refusing, setRefusing] = React.useState(false);
  const [reason, setReason] = React.useState("");

  return (
    <>
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          startIcon={<X />}
          disabled={pending}
          onClick={() => setRefusing(true)}
        >
          Refuse
        </Button>
        <Button
          type="button"
          size="sm"
          startIcon={<Check />}
          loading={pending}
          loadingText="Approving"
          onClick={() => run(() => approveLeaveTask(subject.id))}
        >
          Approve
        </Button>
      </div>

      <Dialog open={refusing} onOpenChange={setRefusing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refuse this request?</DialogTitle>
            <DialogDescription>
              {subject.name} — {subject.detail}. They are told the reason.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor={`why-${subject.id}`}>Why?</FieldLabel>
            <Textarea
              id={`why-${subject.id}`}
              rows={3}
              value={reason}
              disabled={pending}
              onChange={(event) => setReason(event.target.value)}
              placeholder="The team is short that week."
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setRefusing(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="md"
              loading={pending}
              loadingText="Refusing"
              disabled={reason.trim().length < 3}
              onClick={() =>
                run(
                  () => refuseLeaveTask(subject.id, reason),
                  () => setRefusing(false),
                )
              }
            >
              Refuse
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InviteRow({ subject }: { subject: DashboardTaskSubject }) {
  const { run, pending } = useTaskAction();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      startIcon={<Send />}
      loading={pending}
      loadingText="Sending"
      onClick={() => run(() => sendInviteTask(subject.id))}
    >
      Send invite
    </Button>
  );
}

/** One subject, with whatever finishing it looks like on the right. */
function SubjectRow({
  kind,
  subject,
  onNavigate,
}: {
  kind: DashboardTaskKind;
  subject: DashboardTaskSubject;
  onNavigate: () => void;
}) {
  const spec = TASKS[kind];

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{subject.name}</p>
        {subject.detail ? (
          <p className="truncate text-xs text-muted-foreground">
            {subject.detail}
          </p>
        ) : null}
      </div>

      {kind === "MISSING_BANK" ? (
        <BankRow subject={subject} />
      ) : kind === "PENDING_LEAVE" ? (
        <LeaveRow subject={subject} />
      ) : kind === "NEVER_INVITED" ? (
        <InviteRow subject={subject} />
      ) : spec.href ? (
        <Link
          href={spec.href(subject)}
          onClick={onNavigate}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {spec.action}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </li>
  );
}

function TaskCard({ task, period }: { task: DashboardTask; period: string }) {
  const spec = TASKS[task.kind];
  const [open, setOpen] = React.useState(false);
  const Icon = spec.icon;

  // The first subject is named in full; the rest are a row of faces. A pay run
  // has no face, so it gets the name alone.
  const next = task.subjects[0] ?? null;
  const rest = PEOPLE_TASKS.has(task.kind) ? task.subjects.slice(1, 4) : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group h-full min-w-52 flex-1 text-left outline-none"
      >
        {/* The stack is the row of faces, not the card. Layered cards behind
            this one only looked like a rendering fault. */}
        <span
          className={cn(
            "relative flex h-full flex-col gap-2.5 overflow-hidden rounded-2xl border border-border bg-card p-3.5",
            "transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg",
            "group-focus-visible:ring-[3px] group-focus-visible:ring-ring",
          )}
        >
          {/* A hairline of the tone across the top, so urgency reads before
              the words do. */}
          <span
            aria-hidden
            className={cn("absolute inset-x-0 top-0 h-0.5", ACCENTS[spec.tone])}
          />

          <span className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-xl",
                TONES[spec.tone],
              )}
            >
              <Icon className="size-4" />
            </span>
            <span
              className={cn(
                "text-xl leading-none font-semibold tabular-nums",
                spec.tone === "urgent" ? "text-destructive" : "text-foreground",
              )}
            >
              {task.count}
            </span>
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {spec.label}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {spec.blurb(period)}
            </span>
          </span>

          {/* The one at the front of the queue, named. A count tells you there
              is work; this tells you what the work is, which is the difference
              between a card you read and a card you act on. */}
          {next ? (
            <span className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/50 p-2">
              {PEOPLE_TASKS.has(task.kind) ? (
                <UserAvatar
                  size="sm"
                  name={next.name}
                  src={avatarUrl(next.employeeId ?? next.id, next.avatarFileId)}
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {next.name}
                </span>
                {next.detail ? (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {next.detail}
                  </span>
                ) : null}
              </span>
            </span>
          ) : null}

          <span className="mt-auto flex items-center justify-between gap-2">
            {rest.length > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="flex -space-x-2">
                  {rest.map((subject) => (
                    <UserAvatar
                      key={subject.id}
                      size="sm"
                      name={subject.name}
                      src={avatarUrl(
                        subject.employeeId ?? subject.id,
                        subject.avatarFileId,
                      )}
                      className="ring-2 ring-card"
                    />
                  ))}
                </span>
                {task.count > rest.length + 1 ? (
                  <span className="text-xs text-muted-foreground">
                    +{task.count - rest.length - 1}
                  </span>
                ) : null}
              </span>
            ) : (
              <span />
            )}

            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              {spec.action}
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{spec.label}</DialogTitle>
            <DialogDescription>{spec.blurb(period)}.</DialogDescription>
          </DialogHeader>

          <ul className="divide-y divide-border">
            {task.subjects.map((subject) => (
              <SubjectRow
                key={subject.id}
                kind={task.kind}
                subject={subject}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ul>

          {task.count > task.subjects.length ? (
            <p className="text-xs text-muted-foreground">
              Showing {task.subjects.length} of {task.count}.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Today, on the viewer's own clock.
 *
 * Rendered from `new Date()` during both passes rather than set in an effect,
 * with the mismatch suppressed: the server's day and the reader's can differ by
 * a timezone, and the reader's is the one that is true for them. There is
 * nothing to reconcile, so there is nothing worth a re-render to reconcile it.
 */
function Today() {
  const now = new Date();
  return (
    <span className="ml-auto text-sm text-primary/70">
      {/* Said outright, because the line beside it names a different month:
          the dashboard reports August while today is September, and a bare
          date there would read as part of the period rather than the clock. */}
      Today is{" "}
      {/* The suppression has to sit on the element holding the differing text,
          not an ancestor of it. The server's timezone and the reader's can
          disagree about the day, and the reader's is the one that is true. */}
      <span suppressHydrationWarning className="font-medium text-primary">
        {now.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </span>
    </span>
  );
}

/**
 * What needs doing, before the numbers describing what has been done.
 *
 * A row of cards rather than a list: these are unrelated to each other, and a
 * list implies an order to work through. Each opens the people or records
 * behind it, and finishes the work there where the work can be finished.
 */
export function TaskStrip({
  tasks,
  period,
}: {
  tasks: DashboardTask[];
  /** The month the dashboard is describing, e.g. "August 2026". */
  period: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Check className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">Your desk is clear</p>
          <p className="text-xs text-muted-foreground">
            No approvals waiting, and nothing blocking {period}.
          </p>
        </div>
      </div>
    );
  }

  const total = tasks.reduce((sum, task) => sum + task.count, 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">On your desk</h2>
        <span className="text-sm text-muted-foreground">
          {total === 1 ? "1 thing" : `${total} things`} to sort out
        </span>
        <span className="text-sm text-muted-foreground/60">· {period}</span>
        <Today />
      </div>
      {/* Scrolls sideways rather than wrapping: the cards are ordered by
          urgency, and wrapping would put the least urgent one beside the most.
          overflow-y is pinned because the spec promotes it to `auto` as soon as
          the other axis is not visible. */}
      <div className="scrollbar-thin -mx-2 -mt-2 -mb-2 flex items-stretch gap-4 overflow-x-auto overflow-y-hidden px-2 pt-2 pb-4">
        {tasks.map((task) => (
          <TaskCard key={task.kind} task={task} period={period} />
        ))}
      </div>
    </section>
  );
}
