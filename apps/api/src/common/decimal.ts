import { Prisma } from '@prisma/client';

/**
 * Money and hour columns are Postgres NUMERIC, which Prisma surfaces as Decimal.
 * Decimal survives JSON.stringify as an object, not a number, so every value
 * crossing the API boundary is normalised here instead of at each call site.
 */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

export function toNumberOrNull(
  value: Prisma.Decimal | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

/** Wrap a JS number for a Decimal column, rounding to the column's scale. */
export function toDecimal(value: number, scale = 2): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(scale));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
