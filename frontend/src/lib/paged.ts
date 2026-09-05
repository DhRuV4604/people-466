import type { Paginated } from "@peoplepay360/shared";

/**
 * Helpers for the screens that want a whole list rather than a page of one.
 *
 * Every list endpoint returns a `Paginated<T>` envelope, which is right for a
 * table with page controls under it. A few surfaces genuinely need everything —
 * the payslips belonging to one pay run, a person's own leave for the year, the
 * options behind a dropdown — and they say so by asking for the largest page
 * the API will serve.
 */

/**
 * Matches MAX_PAGE_SIZE in the API. Past this a list is too long to render in
 * one go anyway, and the screen wants a real page control instead.
 */
export const ALL_ROWS = 500;

/** The empty envelope, for a soft-failed fetch. */
export function emptyPage<T>(): Paginated<T> {
  return { items: [], total: 0, page: 1, pageSize: 0, totalPages: 1 };
}
