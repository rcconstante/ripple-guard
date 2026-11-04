import { parseIssueUpdatedEvent } from '../domain/events';
import type { Commitment } from '../domain/model';
import { installationIdFrom } from '../services/context';
import { fetchIssueFacts } from '../services/jira';
import { refreshRisk } from '../services/risk';
import { commitmentIdsForIssue, getCommitment, removeIssueIndexEntry } from '../services/store';

/**
 * F03 trigger for `avi:jira:updated:issue` (manifest filter: ignoreSelf).
 *
 * 1. Ignore self-generated events and changes to fields the risk rules don't use.
 * 2. Ignore issues not linked to an active commitment (issue index lookup).
 * 3. Re-read the CURRENT state of every linked issue (never trust event data),
 *    as the app: this is a system event with no person involved, and the
 *    result is never used to decide what a person may see.
 * 4. Recompute F04; the snapshot is written only when its signature changes,
 *    so duplicate, retried or out-of-order events have no extra effect.
 * Never mutates Jira, never creates issues, never notifies anyone.
 */
export async function handleIssueUpdated(event: unknown, context: unknown): Promise<void> {
  const parsed = parseIssueUpdatedEvent(event);
  if (!parsed || !parsed.relevant) return;

  const installationId = installationIdFrom(context);
  if (!installationId) return;

  try {
    const commitments: Commitment[] = [];
    for (const id of await commitmentIdsForIssue(parsed.issueId)) {
      const commitment = await getCommitment(id, installationId);
      if (commitment?.lifecycle === 'active' && commitment.linkedIssueIds.includes(parsed.issueId)) {
        commitments.push(commitment);
      } else {
        await removeIssueIndexEntry(parsed.issueId, id); // archived, fulfilled, unlinked or deleted
      }
    }
    if (commitments.length === 0) return;

    const fetch = await fetchIssueFacts(
      [...new Set(commitments.flatMap((c) => c.linkedIssueIds))],
      'app',
    );
    for (const commitment of commitments) {
      await refreshRisk(commitment, fetch);
    }
  } catch (error) {
    // Log only the error type. The next detail view re-evaluates from fresh data.
    console.error('RippleGuard issue trigger failed', error instanceof Error ? error.name : typeof error);
  }
}
