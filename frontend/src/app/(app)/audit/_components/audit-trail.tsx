"use client";

import * as React from "react";
import { ChevronRight, MoveRight } from "lucide-react";
import {
  AUDIT_ACTION_LABELS,
  ROLE_LABELS,
  type AuditAction,
  type AuditLogDto,
} from "@peoplepay360/shared";

import { PersonCell } from "@/components/data/primitives";
import { StatusBadge } from "@/components/data/status-badge";
import { formatDate, formatTime, pluralise } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  ACTION_TONE,
  entityLabel,
  fieldLabel,
  formatValue,
} from "./audit-format";

/**
 * The trail keeps the whole record as it was before a delete, but AuditLogDto
 * has no field for it. It is read here if the API sends one, because a delete
 * is the one entry that cannot be reconstructed from anywhere else.
 */
export type AuditRow = AuditLogDto & {
  snapshot?: Record<string, unknown> | null;
};

/** What the panel says when there is nothing to compare. */
const NO_DIFF: Partial<Record<AuditAction, string>> = {
  CREATE: "The record starts here, so there is nothing to compare it with.",
  LOGIN: "A sign-in changes no record. It is kept so the trail shows who was in.",
  DELETE: "No snapshot was kept, so this record cannot be read back.",
};

/**
 * The trail itself: one line per entry, reading as a sentence, opening onto
 * what actually changed.
 */
export function AuditTrail({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {groupByDay(rows).map((group) => (
        <section key={group.day}>
          {/* The day is said once, so each row only has to carry its time. */}
          <h2 className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
            {formatDate(group.day)}
          </h2>

          <ul className="divide-y divide-border border-b border-border last:border-0">
            {group.rows.map((row) => {
              const isOpen = open.has(row.id);
              const changed = row.changes?.length ?? 0;

              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => toggle(row.id)}
                    aria-expanded={isOpen}
                    aria-controls={`entry-${row.id}`}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
                  >
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground/50 transition-transform",
                        isOpen && "rotate-90",
                      )}
                    />

                    <div className="w-36 shrink-0 sm:w-48">
                      <PersonCell
                        name={row.userName}
                        meta={ROLE_LABELS[row.userRole]}
                      />
                    </div>

                    {/* StatusBadge title-cases a value it has no entry for, so
                        the audit label passes straight through; only the tone
                        needs saying, since an action is not a record status. */}
                    <StatusBadge
                      value={AUDIT_ACTION_LABELS[row.action]}
                      className={cn(
                        "w-28 justify-center",
                        ACTION_TONE[row.action],
                      )}
                    />

                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-muted-foreground">
                        {entityLabel(row.entity)}
                      </span>
                      {row.entityLabel ? (
                        <>
                          {" — "}
                          <span className="font-medium">{row.entityLabel}</span>
                        </>
                      ) : null}
                    </span>

                    <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">
                      {changed > 0 ? pluralise(changed, "field") : null}
                    </span>

                    <time
                      dateTime={row.createdAt}
                      className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
                    >
                      {formatTime(row.createdAt)}
                    </time>
                  </button>

                  {isOpen ? <Detail row={row} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Before and after, or the record that is no longer there. */
function Detail({ row }: { row: AuditRow }) {
  const changes = row.changes ?? [];
  const snapshot = row.snapshot ? Object.entries(row.snapshot) : [];

  return (
    <div
      id={`entry-${row.id}`}
      className="border-t border-border bg-muted/30 px-4 py-4 sm:pl-11"
    >
      {changes.length > 0 ? (
        <Cards>
          {changes.map((change) => (
            <Card key={change.field} label={fieldLabel(change.field)}>
              <Was>{formatValue(change.field, change.from)}</Was>
              <MoveRight className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span className="font-medium break-words">
                {formatValue(change.field, change.to)}
              </span>
            </Card>
          ))}
        </Cards>
      ) : snapshot.length > 0 ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            The record as it was when it was deleted.
          </p>
          <Cards>
            {snapshot.map(([field, value]) => (
              <Card key={field} label={fieldLabel(field)}>
                <Was>{formatValue(field, value)}</Was>
              </Card>
            ))}
          </Cards>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {NO_DIFF[row.action] ??
            "No field changed. The action was recorded against the record itself."}
        </p>
      )}

      {/* Which request did it, for the entry that has to be traced back past
          the record it touched. */}
      <p className="mt-4 font-mono text-xs text-muted-foreground">
        {row.method} {row.path}
        {row.ip ? ` · ${row.ip}` : ""} · {formatTime(row.createdAt)}
      </p>
    </div>
  );
}

function Cards({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</ul>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="min-w-0 rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        {children}
      </p>
    </li>
  );
}

/** The old value, struck through so it cannot be mistaken for the new one. */
function Was({ children }: { children: React.ReactNode }) {
  return (
    <span className="break-words text-muted-foreground line-through decoration-muted-foreground/60">
      {children}
    </span>
  );
}

/** Entries arrive newest first, so consecutive runs are the days. */
function groupByDay(rows: AuditRow[]) {
  const groups: { day: string; rows: AuditRow[] }[] = [];

  for (const row of rows) {
    const day = row.createdAt.slice(0, 10);
    const last = groups.at(-1);
    if (last?.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }

  return groups;
}
