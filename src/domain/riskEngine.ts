import { createHash } from 'node:crypto';
import type { Lifecycle, ReasonEvidence, RiskReason } from '../shared/contracts';
import type { IssueFact, RiskEvaluation } from './model';

/**
 * F04 deterministic risk engine: the only authority for risk state.
 * Pure function of the stored promised date, lifecycle, and current Jira facts.
 * The LLM never feeds into this module.
 */

export interface RiskInput {
  promisedDate: string;
  lifecycle: Lifecycle;
  /** Explicit links, in stored order. Only these issues are considered. */
  linkedIssueIds: readonly string[];
  /** Facts keyed by issue id. A linked id without a fact counts as not readable. */
  facts: ReadonlyMap<string, IssueFact>;
  /** `todayUTC` (`YYYY-MM-DD`). */
  today: string;
}

/** Jira status name that triggers EXPLICIT_BLOCKED_STATUS (case-insensitive exact match). */
const BLOCKED_STATUS = 'blocked';

function unreadableFact(issueId: string): IssueFact {
  return {
    issueId,
    readable: false,
    key: null,
    summary: null,
    statusName: null,
    statusCategory: null,
    dueDate: null,
    projectId: null,
    projectKey: null,
  };
}

function evidenceOf(fact: IssueFact): ReasonEvidence {
  return {
    issueId: fact.issueId,
    issueKey: fact.readable ? fact.key : null,
    dueDate: fact.readable ? fact.dueDate : null,
    statusName: fact.readable ? fact.statusName : null,
  };
}

function linkedFacts(input: RiskInput): IssueFact[] {
  return input.linkedIssueIds.map((id) => input.facts.get(id) ?? unreadableFact(id));
}

/**
 * Evaluate a commitment. Returns null when the commitment is not active
 * (fulfilled/archived are excluded from risk evaluation).
 *
 * Precedence (first match wins), reporting every applicable reason of the winning class:
 *   1. overdue       PROMISE_DATE_PASSED
 *   2. at_risk       ISSUE_DUE_AFTER_PROMISE, EXPLICIT_BLOCKED_STATUS
 *   3. needs_review  ISSUE_NOT_READABLE, MISSING_ISSUE_DUE_DATE, WORK_DONE_AWAITING_CONFIRMATION
 *   4. on_track
 */
export function evaluateRisk(input: RiskInput): RiskEvaluation | null {
  if (input.lifecycle !== 'active') return null;

  // 1. Overdue: today is strictly after the promised date. Due today is not overdue.
  if (input.today > input.promisedDate) {
    return { status: 'overdue', reasons: [{ code: 'PROMISE_DATE_PASSED', evidence: [] }] };
  }

  const issues = linkedFacts(input);

  // No explicit links: never report a healthy status.
  if (issues.length === 0) {
    return { status: 'needs_review', reasons: [] };
  }

  // 2. At risk.
  const dueAfterPromise = issues.filter(
    (i) => i.readable && i.dueDate !== null && i.dueDate > input.promisedDate,
  );
  const blocked = issues.filter(
    (i) => i.readable && i.statusName !== null && i.statusName.toLowerCase() === BLOCKED_STATUS,
  );
  if (dueAfterPromise.length > 0 || blocked.length > 0) {
    const reasons: RiskReason[] = [];
    if (dueAfterPromise.length > 0) {
      reasons.push({ code: 'ISSUE_DUE_AFTER_PROMISE', evidence: dueAfterPromise.map(evidenceOf) });
    }
    if (blocked.length > 0) {
      reasons.push({ code: 'EXPLICIT_BLOCKED_STATUS', evidence: blocked.map(evidenceOf) });
    }
    return { status: 'at_risk', reasons };
  }

  // 3. Needs review.
  const notReadable = issues.filter((i) => !i.readable);
  const missingDueDate = issues.filter((i) => i.readable && i.dueDate === null);
  const allDone = issues.every((i) => i.readable && i.statusCategory === 'done');
  if (notReadable.length > 0 || missingDueDate.length > 0 || allDone) {
    const reasons: RiskReason[] = [];
    if (notReadable.length > 0) {
      reasons.push({ code: 'ISSUE_NOT_READABLE', evidence: notReadable.map(evidenceOf) });
    }
    if (missingDueDate.length > 0) {
      reasons.push({ code: 'MISSING_ISSUE_DUE_DATE', evidence: missingDueDate.map(evidenceOf) });
    }
    if (allDone) {
      reasons.push({ code: 'WORK_DONE_AWAITING_CONFIRMATION', evidence: issues.map(evidenceOf) });
    }
    return { status: 'needs_review', reasons };
  }

  // 4. On track: all readable, all due on/before the promise, none Blocked, not all done.
  return { status: 'on_track', reasons: [] };
}

/**
 * Stable signature of the inputs that matter to F04, used to skip duplicate
 * writes and make event processing idempotent. It includes whether the promise
 * date has passed (not the date itself), so it only changes when the outcome can.
 */
export function riskInputSignature(input: RiskInput): string {
  const issues = linkedFacts(input)
    .map((i) => [i.issueId, i.readable, i.statusName, i.statusCategory, i.dueDate] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const material = JSON.stringify({
    promisedDate: input.promisedDate,
    lifecycle: input.lifecycle,
    promisePassed: input.today > input.promisedDate,
    issues,
  });
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
