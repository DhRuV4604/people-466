/**
 * A syntactically valid record id that no row will ever hold.
 *
 * Employee-scoped queries need a "match nothing" value when the signed-in
 * account has no linked employee record. Leaving the filter off entirely would
 * widen the query to every employee, which is the opposite of what the scoping
 * is for, so the filter stays and is pointed at an id that cannot exist.
 *
 * Ids are cuids, not UUIDs, and the columns are text, so any well-formed
 * string that no generator would produce works here.
 */
export const NO_MATCH_ID = 'no_match_00000000000000000';
