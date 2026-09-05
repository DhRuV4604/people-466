/**
 * The URL contract for a paginated list, kept apart from the control that
 * renders it.
 *
 * Server components read these to build their API query, and `pagination.tsx`
 * is a client component — importing them from there would drag a client module
 * into a server render and fail at the boundary.
 */

/** The sizes offered. 20 is the default the API applies when none is asked for. */
export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * The two URL keys a list reads and writes.
 *
 * A screen holding more than one list — the time off tabs, the four reference
 * tables in settings — gives each its own prefix, so paging one cannot move
 * another. A screen with a single list passes nothing and gets `page` and
 * `pageSize`, which is what a shared link should look like in the common case.
 */
export function pageKeys(prefix?: string): { page: string; pageSize: string } {
  return prefix
    ? { page: `${prefix}Page`, pageSize: `${prefix}PageSize` }
    : { page: "page", pageSize: "pageSize" };
}

/**
 * Reads the page and page size a list should request. Kept here so a page and
 * this control cannot disagree about what the URL means.
 */
export function pageQuery(
  params: Record<string, string | undefined>,
  prefix?: string,
): { page: number; pageSize: number } {
  const keys = pageKeys(prefix);
  const page = Number(params[keys.page]);
  const pageSize = Number(params[keys.pageSize]);
  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), 100)
        : DEFAULT_PAGE_SIZE,
  };
}
