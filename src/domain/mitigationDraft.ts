import { RISK_LABELS, type RiskReason, type RiskStatus } from '../shared/contracts';
import type { Commitment, IssueFact } from './model';
import { issueBrowseUrl } from './urls';

/**
 * F06 mitigation draft: only factual, sourced statements plus clearly labelled
 * suggestions. The owner may edit it before confirming.
 */

export const COMMITMENT_ID_LINE = (id: string) => `RippleGuard commitment ID: ${id}`;

function reasonLine(reason: RiskReason, promisedDate: string, today: string): string[] {
  switch (reason.code) {
    case 'PROMISE_DATE_PASSED':
      return [`- PROMISE_DATE_PASSED: the promised date ${promisedDate} has passed (today is ${today}, UTC).`];
    case 'ISSUE_DUE_AFTER_PROMISE':
      return reason.evidence.map(
        (e) => `- ISSUE_DUE_AFTER_PROMISE: ${e.issueKey ?? e.issueId} is due ${e.dueDate}, after the promised date ${promisedDate}.`,
      );
    case 'EXPLICIT_BLOCKED_STATUS':
      return reason.evidence.map((e) => `- EXPLICIT_BLOCKED_STATUS: ${e.issueKey ?? e.issueId} has the status Blocked.`);
    default:
      return [`- ${reason.code}`];
  }
}

export function buildMitigationSummary(commitment: Commitment): string {
  return `Mitigate delivery risk: ${commitment.title}`.slice(0, 255);
}

export function buildMitigationDescription(input: {
  commitment: Commitment;
  status: RiskStatus;
  reasons: RiskReason[];
  evaluatedForDate: string;
  issues: IssueFact[];
  siteBaseUrl: string;
}): string {
  const { commitment, status, reasons, evaluatedForDate, issues, siteBaseUrl } = input;
  const issueLines = issues
    .filter((i) => i.readable && i.key)
    .map((i) => `- ${i.key}${i.summary ? ` ${i.summary}` : ''}: ${issueBrowseUrl(siteBaseUrl, i.key as string)}`);

  return [
    'RippleGuard detected a delivery risk for a recorded customer commitment.',
    '',
    `Commitment: ${commitment.title}`,
    `Customer: ${commitment.customerLabel}`,
    `Promised date: ${commitment.promisedDate}`,
    `Risk status: ${RISK_LABELS[status]} (computed by RippleGuard rules for ${evaluatedForDate}, UTC)`,
    '',
    'Risk reasons:',
    ...reasons.flatMap((r) => reasonLine(r, commitment.promisedDate, evaluatedForDate)),
    '',
    'Linked Jira issues:',
    ...issueLines,
    '',
    `Evidence link (recorded by the commitment owner): ${commitment.sourceUrl}`,
    '',
    'Suggested next steps (suggestions only, not decisions):',
    '- Review whether the linked work can be re-planned to meet the promised date.',
    '- Decide with the commitment owner whether the promised date needs to be renegotiated.',
    '',
    COMMITMENT_ID_LINE(commitment.id),
  ].join('\n');
}

/** Ensure the description keeps the commitment id line used for manual reconciliation. */
export function withCommitmentIdLine(description: string, commitmentId: string): string {
  const line = COMMITMENT_ID_LINE(commitmentId);
  return description.includes(line) ? description : `${description.trimEnd()}\n\n${line}`;
}
