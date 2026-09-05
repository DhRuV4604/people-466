import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Paginated } from '@peoplepay360/shared';

/**
 * Page-based pagination, shared by every list endpoint.
 *
 * Page-based rather than cursor-based on purpose: these lists are filtered and
 * sorted by columns the user picks, and a page number is what the UI shows and
 * what a shared link has to carry. A cursor would be faster on a very large
 * table but cannot answer "page 7 of 12", which is the whole control.
 */

export const DEFAULT_PAGE_SIZE = 20;

/**
 * The ceiling exists because a page size is a URL parameter: without it anyone
 * could ask for every row of every table in one request. It is also the size a
 * caller passes when it genuinely needs the whole list — the payslips on a pay
 * run, say — so it has to be comfortably above any real table's row count.
 */
export const MAX_PAGE_SIZE = 500;

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'One-based page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    description: 'Rows per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

/** The `skip`/`take` a Prisma query needs, plus the numbers echoed back. */
export function pageArgs(query: PaginationQueryDto): {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
} {
  const pageSize = Math.min(Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const page = Math.max(query.page ?? 1, 1);
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

/**
 * Wraps a page of rows with the counts the client needs to render the control.
 *
 * `total` is the count of everything matching the filter, not of this page:
 * "21–40 of 62" and the last page number both depend on it.
 */
export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    // A filter matching nothing still has one (empty) page, so the control
    // reads "page 1 of 1" rather than "page 1 of 0".
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
