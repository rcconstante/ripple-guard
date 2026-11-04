/**
 * F03 event filtering for `avi:jira:updated:issue`.
 * Only due date and status changes can change a risk status (F04 uses due
 * date, status name and status category). Self-generated events are ignored.
 * The handler always re-reads current issue state, so this filter only avoids
 * unnecessary work; it is never used as the source of truth.
 */

export const RELEVANT_FIELDS = new Set(['duedate', 'status']);

export interface IssueUpdatedEvent {
  issueId: string;
  relevant: boolean;
}

type UnknownRecord = Record<string, unknown>;
const asRecord = (v: unknown): UnknownRecord | null => (typeof v === 'object' && v !== null ? (v as UnknownRecord) : null);

/** Parse the event; null when it has no usable issue id or was caused by this app. */
export function parseIssueUpdatedEvent(event: unknown): IssueUpdatedEvent | null {
  const e = asRecord(event);
  if (!e || e.selfGenerated === true) return null;
  const issue = asRecord(e.issue);
  const rawId = issue?.id;
  const issueId = typeof rawId === 'number' ? String(rawId) : typeof rawId === 'string' ? rawId : null;
  if (!issueId || !/^[1-9]\d{0,17}$/.test(issueId)) return null;

  const items = asRecord(e.changelog)?.items;
  // No changelog: we can't tell what changed, so re-evaluate (safe: fresh read, idempotent write).
  if (!Array.isArray(items)) return { issueId, relevant: true };

  const relevant = items.some((item) => {
    const it = asRecord(item);
    const names = [it?.field, it?.fieldId].filter((v): v is string => typeof v === 'string').map((v) => v.toLowerCase());
    return names.some((n) => RELEVANT_FIELDS.has(n));
  });
  return { issueId, relevant };
}
