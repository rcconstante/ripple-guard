/**
 * Date-only helpers (FEATURE_SCOPE F04 "UTC date rule").
 *
 * All commitment and Jira due dates are compared as `YYYY-MM-DD` strings.
 * The single time boundary is UTC: `todayUTC = new Date().toISOString().slice(0, 10)`.
 * Lexicographic comparison of valid `YYYY-MM-DD` strings equals chronological order.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date at the UTC boundary, as `YYYY-MM-DD`. */
export function todayUTC(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True for a real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30). */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

/** Jira `duedate` values are already date-only; anything else is treated as missing. */
export function normalizeJiraDueDate(value: unknown): string | null {
  return isDateOnly(value) ? value : null;
}
