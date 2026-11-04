import { decideReadAccess } from '../domain/access';
import type { Commitment, IssueFact, RiskSnapshot } from '../domain/model';
import type { CommitmentDetail, CommitmentPermissions, RiskExplanation } from '../shared/contracts';
import { explainRisk } from './ai';
import type { Caller } from './context';
import { fetchIssueFacts } from './jira';
import { refreshRisk } from './risk';
import { getMitigation, putRiskSnapshot } from './store';
import { linkedIssueViews, toMitigationView, toSummary } from './views';

/**
 * Authorized read service shared by the Custom UI resolvers and the three
 * read-only Rovo/MCP actions, so both enforce exactly the same access policy:
 * a commitment is visible only when the caller can read every linked issue
 * right now. Every call re-reads Jira as the caller; nothing is cached as an
 * authorization.
 */

export interface AccessibleCommitment {
  commitment: Commitment;
  /** Current facts for every linked issue, all readable by the caller. */
  facts: Map<string, IssueFact>;
  snapshot: RiskSnapshot | null;
}

export type AccessibleLoad =
  | { jiraAvailable: true; items: AccessibleCommitment[] }
  /** Jira could not be reached: visibility can't be verified, so nothing is returned. */
  | { jiraAvailable: false; items: [] };

/** Filter commitments to those the caller may read, refreshing each active risk snapshot. */
export async function loadAccessible(commitments: Commitment[]): Promise<AccessibleLoad> {
  if (commitments.length === 0) return { jiraAvailable: true, items: [] };
  const fetch = await fetchIssueFacts([...new Set(commitments.flatMap((c) => c.linkedIssueIds))], 'user');
  if (!fetch.ok) return { jiraAvailable: false, items: [] };

  const granted: Array<{ commitment: Commitment; facts: Map<string, IssueFact> }> = [];
  for (const commitment of commitments) {
    const access = decideReadAccess(commitment, fetch);
    if (access.level === 'full') granted.push({ commitment, facts: access.facts });
  }

  const items = await Promise.all(
    granted.map(async ({ commitment, facts }) => ({
      commitment,
      facts,
      snapshot: await refreshRisk(commitment, fetch),
    })),
  );
  return { jiraAvailable: true, items };
}

export function summaryOf(item: AccessibleCommitment, caller: Caller, siteBaseUrl: string) {
  return toSummary(
    item.commitment,
    caller.accountId,
    item.snapshot,
    linkedIssueViews(item.commitment, item.facts, siteBaseUrl),
  );
}

export function permissionsFor(item: AccessibleCommitment, caller: Caller, hasMitigation: boolean): CommitmentPermissions {
  const { commitment, snapshot } = item;
  const isOwner = commitment.ownerAccountId === caller.accountId;
  const active = commitment.lifecycle === 'active';
  const risky = snapshot !== null && !snapshot.stale && (snapshot.status === 'at_risk' || snapshot.status === 'overdue');
  return {
    canEdit: isOwner && active,
    canFulfill: isOwner && active,
    canArchive: isOwner && (active || commitment.lifecycle === 'fulfilled'),
    canCreateMitigation: isOwner && active && risky && !hasMitigation,
  };
}

async function explanationFor(item: AccessibleCommitment): Promise<RiskExplanation | null> {
  const { commitment, snapshot } = item;
  if (commitment.lifecycle !== 'active' || !snapshot) return null;

  // Defensive: a stale snapshot gets deterministic wording only, no LLM call.
  if (snapshot.stale) {
    return {
      text: `RippleGuard could not verify current Jira data. This is the last status it stored (evaluated for ${snapshot.evaluatedForDate}, UTC).`,
      source: 'rules',
    };
  }
  if (snapshot.explanation?.signature === snapshot.signature) {
    return { text: snapshot.explanation.text, source: snapshot.explanation.source };
  }
  const explanation = await explainRisk({ title: commitment.title, promisedDate: commitment.promisedDate, snapshot });
  await putRiskSnapshot({ ...snapshot, explanation: { signature: snapshot.signature, ...explanation } });
  return explanation;
}

export async function detailOf(
  item: AccessibleCommitment,
  caller: Caller,
  siteBaseUrl: string,
): Promise<CommitmentDetail> {
  const { commitment } = item;
  const mitigation = await getMitigation(commitment.id, commitment.installationId);
  // A definitively failed attempt leaves no mitigation: the owner may try again.
  const active = mitigation && mitigation.state !== 'failed' ? mitigation : null;
  return {
    ...summaryOf(item, caller, siteBaseUrl),
    sourceUrl: commitment.sourceUrl,
    evidenceExcerpt: commitment.evidenceExcerpt,
    ownerAccountId: commitment.ownerAccountId,
    createdAt: commitment.createdAt,
    updatedAt: commitment.updatedAt,
    fulfilledAt: commitment.fulfilledAt,
    explanation: await explanationFor(item),
    mitigation: toMitigationView(active, siteBaseUrl),
    permissions: permissionsFor(item, caller, active !== null),
  };
}
