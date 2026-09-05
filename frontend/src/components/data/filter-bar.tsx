"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";

import {
  Button,
  IconButton,
  Input,
  InputAddon,
  InputGroup,
  Select,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; disabled?: boolean };

export type FilterSelect = {
  /** Query-string key this select writes to. */
  key: string;
  /** Label shown when nothing is chosen. */
  placeholder: string;
  options: FilterOption[];
  width?: string;
};

export type QuickFilter = {
  key: string;
  value: string;
  label: string;
};

const ALL = "__all__";

/**
 * The filter bar every list screen uses.
 *
 * Filters live in the URL, so a filtered view can be linked and shared, the
 * back button behaves, and the server does the filtering. Screens declare what
 * they filter on; the layout, the debounce, the chips and the clear behaviour
 * are all handled here so no two lists behave differently.
 */
export function FilterBar({
  search,
  selects = [],
  quickFilters = [],
  count,
  actions,
  views = false,
}: {
  search?: { placeholder: string; label?: string };
  selects?: FilterSelect[];
  quickFilters?: QuickFilter[];
  count?: { total: number; noun: string; plural?: string };
  actions?: React.ReactNode;
  /** Adds a cards/list switch writing to `view`. */
  views?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = React.useTransition();

  const currentQuery = params.get("q") ?? "";
  const [term, setTerm] = React.useState(currentQuery);
  const [synced, setSynced] = React.useState(currentQuery);

  // Keep the box in step when the URL changes from elsewhere, such as a chip
  // being cleared or the back button. Adjusting during render rather than in
  // an effect avoids a second paint with the stale value.
  if (currentQuery !== synced) {
    setSynced(currentQuery);
    setTerm(currentQuery);
  }

  const apply = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Narrowing the results renumbers them, so page 5 of the old list is
      // usually past the end of the new one. Every filter change starts again
      // at the first page; the page size is a preference and survives.
      //
      // Any prefixed page key too, for a screen holding more than one list.
      for (const key of [...next.keys()]) {
        if (key === "page" || key.endsWith("Page")) next.delete(key);
      }
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [params, pathname, router],
  );

  // Debounce typing so a search is one request per pause, not per keystroke.
  React.useEffect(() => {
    if (term === currentQuery) return;
    const timer = setTimeout(() => apply({ q: term || null }), 350);
    return () => clearTimeout(timer);
  }, [term, currentQuery, apply]);

  const view = params.get("view") === "list" ? "list" : "cards";

  // Anything set through a select, shown so it can be undone without hunting
  // for the control that set it.
  const activeSelects = selects
    .map((select) => {
      const value = params.get(select.key);
      if (!value) return null;
      const option = select.options.find((o) => o.value === value);
      return { key: select.key, label: option?.label ?? value };
    })
    .filter(Boolean) as { key: string; label: string }[];

  const hasFilters =
    Boolean(currentQuery) ||
    activeSelects.length > 0 ||
    quickFilters.some((q) => params.get(q.key) === q.value);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {search ? (
          <InputGroup size="md" className="min-w-[220px] flex-1 sm:max-w-sm">
            <InputAddon>
              <Search />
            </InputAddon>
            <Input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={search.placeholder}
              aria-label={search.label ?? search.placeholder}
            />
            {term ? (
              <InputAddon side="end">
                <IconButton
                  size="sm"
                  label="Clear search"
                  icon={<X />}
                  onClick={() => setTerm("")}
                />
              </InputAddon>
            ) : null}
          </InputGroup>
        ) : null}

        {selects.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {selects.map((select) => (
              <Select
                key={select.key}
                size="md"
                className={select.width ?? "w-40"}
                placeholder={select.placeholder}
                options={[
                  { value: ALL, label: select.placeholder },
                  ...select.options,
                ]}
                value={params.get(select.key) ?? ALL}
                onValueChange={(value) =>
                  apply({ [select.key]: value === ALL ? null : value })
                }
              />
            ))}
          </div>
        ) : null}

        {views || actions ? (
          <div className="ml-auto flex items-center gap-3">
            {views ? (
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(value) => value && apply({ view: value })}
              >
                <ToggleGroupItem value="cards" aria-label="Card view">
                  <LayoutGrid />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <List />
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>

      {count || quickFilters.length > 0 || hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          {count ? (
            <span
              aria-live="polite"
              className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums"
            >
              {count.total}{" "}
              {count.total === 1
                ? count.noun
                : (count.plural ?? `${count.noun}s`)}
            </span>
          ) : null}

          {quickFilters.length > 0 ? (
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          ) : null}

          {quickFilters.map((quick) => {
            const active = params.get(quick.key) === quick.value;
            return (
              <Chip
                key={`${quick.key}:${quick.value}`}
                active={active}
                onClick={() =>
                  apply({ [quick.key]: active ? null : quick.value })
                }
              >
                {quick.label}
              </Chip>
            );
          })}

          {currentQuery ? (
            <Chip removable onClick={() => apply({ q: null })}>
              “{currentQuery}”
            </Chip>
          ) : null}

          {activeSelects.map((active) => (
            <Chip
              key={active.key}
              removable
              onClick={() => apply({ [active.key]: null })}
            >
              {active.label}
            </Chip>
          ))}

          {hasFilters ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() =>
                apply(
                  Object.fromEntries([
                    ["q", null],
                    ...selects.map((s) => [s.key, null]),
                    ...quickFilters.map((q) => [q.key, null]),
                  ]),
                )
              }
            >
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A pill. Pressed when the filter it represents is on. */
function Chip({
  active,
  onClick,
  children,
  removable,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  removable?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={removable ? undefined : !!active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      {removable ? <X className="size-3" /> : null}
    </button>
  );
}
