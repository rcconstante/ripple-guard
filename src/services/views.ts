import type { Commitment, IssueFact, MitigationReference, RiskSnapshot } from '../domain/model';
import { issueBrowseUrl } from '../domain/urls';
import type { CommitmentSummary, LinkedIssueView, MitigationView, RiskView } from '../shared/contracts';

/** Map stored records and fresh facts to the view models in the contract. */

export function toLinkedIssueView(fact: IssueFact, siteBaseUrl: string): LinkedIssueView {
  if (!fact.readable) {
    return {
      id: fact.issueId,
      readable: false,
      key: null,
      summary: null,
      statusName: null,
      statusCategory: null,
      dueDate: null,
      projectKey: null,
      url: null,
    };
  }
  return {
    id: fact.issueId,
    readable: true,
    key: fact.key,
    summary: fact.summary,
    statusName: fact.statusName,
    statusCategory: fact.statusCategory,
    dueDate: fact.dueDate,
    projectKey: fact.projectKey,
    url: fact.key ? issueBrowseUrl(siteBaseUrl, fact.key) : null,
  };
}

/** Linked issues in stored order. */
export function linkedIssueViews(
  commitment: Commitment,
  facts: Map<string, IssueFact>,
  siteBaseUrl: string,
): LinkedIssueView[] {
  return commitment.linkedIssueIds.map((id) =>
    toLinkedIssueView(facts.get(id) ?? { issueId: id, readable: false, key: null, summary: null, statusName: null, statusCategory: null, dueDate: null, projectId: null, projectKey: null }, siteBaseUrl),
  );
}

export function toRiskView(snapshot: RiskSnapshot | null): RiskView | null {
  if (!snapshot) return null;
  return {
    status: snapshot.status,
    reasons: snapshot.reasons.map((r) => ({ code: r.code, evidence: r.evidence.map((e) => ({ ...e })) })),
    evaluatedAt: snapshot.evaluatedAt,
    evaluatedForDate: snapshot.evaluatedForDate,
    stale: snapshot.stale,
  };
}

export function toSummary(
  commitment: Commitment,
  accountId: string,
  snapshot: RiskSnapshot | null,
  issues: LinkedIssueView[],
): CommitmentSummary {
  return {
    id: commitment.id,
    title: commitment.title,
    customerLabel: commitment.customerLabel,
    promisedDate: commitment.promisedDate,
    lifecycle: commitment.lifecycle,
    isOwner: commitment.ownerAccountId === accountId,
    risk: commitment.lifecycle === 'active' ? toRiskView(snapshot) : null,
    issues,
  };
}

export function toMitigationView(ref: MitigationReference | null, siteBaseUrl: string): MitigationView | null {
  if (!ref || ref.state === 'failed') return null;
  const base = siteBaseUrl.replace(/\/+$/, '');
  return {
    state: ref.state,
    jiraIssueId: ref.jiraIssueId,
    jiraIssueKey: ref.jiraIssueKey,
    url: ref.jiraIssueKey ? issueBrowseUrl(siteBaseUrl, ref.jiraIssueKey) : null,
    createdAt: ref.createdAt,
    createdByAccountId: ref.createdByAccountId,
    reconcileSearchUrl:
      ref.state === 'pending'
        ? `${base}/issues/?jql=${encodeURIComponent(`text ~ "${ref.commitmentId}" ORDER BY created DESC`)}`
        : null,
  };
}
