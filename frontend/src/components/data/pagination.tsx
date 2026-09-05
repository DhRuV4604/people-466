"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Paginated } from "@peoplepay360/shared";

import { Button, Select } from "@/components/ui";
import {
  PAGE_SIZES,
  pageKeys,
} from "@/components/data/pagination-params";

type Props = {
  /** The envelope the API returned, minus its rows. */
  meta: Pick<Paginated<unknown>, "total" | "page" | "pageSize" | "totalPages">;
  /** What the rows are, for the count: "employee" reads "1–20 of 62 employees". */
  noun: string;
  plural?: string;
  /** Set where a screen shows more than one list. See `pageKeys`. */
  param?: string;
};

/**
 * Page controls for a list: which rows you are looking at, how to move, and how
 * many to show at a time.
 *
 * It writes to the URL rather than holding state, so a page is part of the
 * address like every other filter here — a link to page 3 opens page 3, and the
 * back button steps through pages the way it steps through anything else.
 */
export function Pagination({ meta, noun, plural, param }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = React.useTransition();

  const { total, page, pageSize, totalPages } = meta;
  const keys = pageKeys(param);

  const go = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
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

  // Nothing to page through and nothing to resize: the control would only be
  // noise under a list that already shows everything it has.
  if (total <= PAGE_SIZES[0] && totalPages <= 1) return null;

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const word = total === 1 ? noun : (plural ?? `${noun}s`);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {total === 0 ? (
          `No ${plural ?? `${noun}s`}`
        ) : (
          <>
            <span className="font-medium text-foreground">
              {first}–{last}
            </span>{" "}
            of {total} {word}
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Per page</span>
          <Select
            size="md"
            className="w-20"
            value={String(pageSize)}
            options={PAGE_SIZES.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            // Changing the size changes which rows page 3 holds, so the only
            // honest place to land is the start.
            onValueChange={(value) =>
              go({ [keys.pageSize]: value, [keys.page]: null })
            }
          />
        </label>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() =>
              go({ [keys.page]: page <= 2 ? null : String(page - 1) })
            }
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums">
            {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => go({ [keys.page]: String(page + 1) })}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
