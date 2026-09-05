/**
 * A syntactically valid UUID that no record will ever hold.
 *
 * Employee-scoped queries need a "match nothing" value when the signed-in
 * account has no linked employee record. A sentinel like NO_MATCH_UUID cannot be
 * used: the columns are Postgres `uuid`, so a malformed value makes the whole
 * query error instead of returning an empty set.
 */
export const NO_MATCH_UUID = '00000000-0000-0000-0000-000000000000';
