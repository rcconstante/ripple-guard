import { decideReadAccess } from '../domain/access';
import { plainTextToAdf } from '../domain/adf';
import { buildMitigationDescription, buildMitigationSummary, withCommitmentIdLine } from '../domain/mitigationDraft';
import type { Commitment, MitigationReference, RiskSnapshot } from '../domain/model';
import type { CreateMitigationInput, CreateMitigationResult, MitigationDraft, Result } from '../shared/contracts';
import type { Caller } from './context';
import { createIssueAsUser, fetchIssueFacts, findTaskIssueType, isPlatformAuthError } from './jira';
import { fail, MESSAGES, ok } from './result';
import { refreshRisk } from './risk';
import { claimMitigationAttempt, getCommitment, getMitigation, putMitigation } from './store';
import { toMitigationView } from './views';

/**
 * F06: preview, then explicitly confirm, ONE Jira Task per commitment, created
 * as the owner. Previewing has no side effects.
 *
 * Duplicate safety:
 * - Every create attempt first claims an attempt number atomically in KVS
 *   (store.claimMitigationAttempt), so repeat clicks and concurrent retries
 *   can't both call Jira.
 * - The slot is released (state `failed`) only when Jira definitively rejected
 *   the request (4xx). If the outcome is unknown (network error, timeout, 5xx)
 *   the record stays `pending`: Jira may have created the issue, so RippleGuard
 *   never says "not created" and never retries on its own.
 * - A `pending` record is released only by the owner, after reviewing Jira
 *   (`acknowledgePendingReview`), and only once it is old enough that the
 *   original attempt can no longer be running. No automatic reconciliation.
 */

/** Longer than the Forge resolver time limit, so the original attempt has ended. */
export const PENDING_REVIEW_MIN_AGE_MS = 60_000;

interface Ready {
  commitment: Commitment;
  snapshot: RiskSnapshot;
  draft: MitigationDraft;
  existing: MitigationReference | null;
}

async function prepare(caller: Caller, commitmentId: string, siteBaseUrl: string): Promise<Result<Ready>> {
  const commitment = await getCommitment(commitmentId, caller.installationId);
  if (!commitment) return fail('NOT_FOUND', MESSAGES.notFound);

  const fetch = await fetchIssueFacts(commitment.linkedIssueIds, 'user');
  if (!fetch.ok) return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
  const access = decideReadAccess(commitment, fetch);
  if (access.level === 'denied') return fail('NOT_FOUND', MESSAGES.notFound);
  if (commitment.ownerAccountId !== caller.accountId) return fail('NOT_OWNER', MESSAGES.notOwner);
  if (commitment.lifecycle !== 'active') {
    return fail('INVALID_STATE', 'Mitigations can only be created for active commitments.');
  }

  const snapshot = await refreshRisk(commitment, fetch);
  if (!snapshot || snapshot.stale || (snapshot.status !== 'at_risk' && snapshot.status !== 'overdue')) {
    return fail('INVALID_STATE', 'A mitigation can only be created while the commitment is At risk or Overdue.');
  }

  const existing = await getMitigation(commitment.id, commitment.installationId);
  if (existing?.state === 'created') {
    return fail('MITIGATION_EXISTS', `A mitigation issue already exists for this commitment (${existing.jiraIssueKey}).`);
  }

  const firstIssue = access.facts.get(commitment.linkedIssueIds[0] ?? '');
  if (!firstIssue?.projectId || !firstIssue.projectKey) {
    return fail('JIRA_UNAVAILABLE', "The first linked issue's project could not be read.");
  }

  const taskType = await findTaskIssueType(firstIssue.projectId);
  if (taskType.kind === 'unavailable') return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
  if (taskType.kind === 'no-permission') {
    return fail('JIRA_CREATE_FAILED', `You don't have permission to create issues in project ${firstIssue.projectKey}.`);
  }
  if (taskType.kind === 'no-task') {
    return fail(
      'UNSUPPORTED_PROJECT',
      `Project ${firstIssue.projectKey} doesn't offer the standard Task issue type, so RippleGuard can't create a mitigation issue there.`,
    );
  }

  const draft: MitigationDraft = {
    commitmentId: commitment.id,
    projectId: firstIssue.projectId,
    projectKey: firstIssue.projectKey,
    issueTypeId: taskType.issueTypeId,
    issueTypeName: 'Task',
    summary: buildMitigationSummary(commitment),
    description: buildMitigationDescription({
      commitment,
      status: snapshot.status,
      reasons: snapshot.reasons,
      evaluatedForDate: snapshot.evaluatedForDate,
      issues: commitment.linkedIssueIds.flatMap((id) => {
        const fact = access.facts.get(id);
        return fact ? [fact] : [];
      }),
      siteBaseUrl,
    }),
    reasonCodes: snapshot.reasons.map((r) => r.code),
  };
  return ok({ commitment, snapshot, draft, existing });
}

/** Read-only draft for the review modal. Never creates anything (F06-T02). */
export async function previewMitigation(caller: Caller, commitmentId: string, siteBaseUrl: string): Promise<Result<MitigationDraft>> {
  const ready = await prepare(caller, commitmentId, siteBaseUrl);
  return ready.ok ? ok(ready.data.draft) : ready;
}

/** Create the mitigation issue after the owner clicked "Confirm create issue". */
export async function createMitigation(
  caller: Caller,
  input: CreateMitigationInput,
  siteBaseUrl: string,
  now: Date = new Date(),
): Promise<Result<CreateMitigationResult>> {
  const ready = await prepare(caller, input.commitmentId, siteBaseUrl);
  if (!ready.ok) return ready;
  const { commitment, snapshot, draft, existing } = ready.data;

  if (existing?.state === 'pending') {
    if (!input.acknowledgePendingReview) {
      return fail(
        'MITIGATION_PENDING',
        'An earlier attempt may already have created a mitigation issue. Check Jira before trying again.',
      );
    }
    if (now.getTime() - Date.parse(existing.createdAt) < PENDING_REVIEW_MIN_AGE_MS) {
      return fail(
        'MITIGATION_PENDING',
        'An attempt started less than a minute ago may still be running. Wait a minute, check Jira, then try again.',
      );
    }
  }

  const pending: MitigationReference = {
    commitmentId: commitment.id,
    installationId: commitment.installationId,
    state: 'pending',
    attempt: (existing?.attempt ?? 0) + 1,
    jiraIssueId: null,
    jiraIssueKey: null,
    createdByAccountId: caller.accountId,
    createdAt: now.toISOString(),
    riskFingerprint: snapshot.signature,
  };

  if (!(await claimMitigationAttempt(pending))) {
    const latest = await getMitigation(commitment.id, commitment.installationId);
    return latest?.state === 'created'
      ? fail('MITIGATION_EXISTS', `A mitigation issue already exists for this commitment (${latest.jiraIssueKey}).`)
      : fail('MITIGATION_PENDING', 'Another attempt to create this mitigation issue is in progress. Check Jira before trying again.');
  }

  let outcome;
  try {
    outcome = await createIssueAsUser({
      projectId: draft.projectId,
      issueTypeId: draft.issueTypeId,
      summary: input.summary,
      description: plainTextToAdf(withCommitmentIdLine(input.description, commitment.id)),
    });
  } catch (error) {
    // The user still has to grant access: no request reached Jira.
    if (isPlatformAuthError(error)) await putMitigation({ ...pending, state: 'failed' });
    throw error;
  }

  if (outcome.kind === 'rejected') {
    // Jira refused the request, so nothing exists: allow a new attempt.
    await putMitigation({ ...pending, state: 'failed' });
    return fail('JIRA_CREATE_FAILED', `No issue was created. ${outcome.message}`);
  }

  if (outcome.kind === 'unknown') {
    // Jira may have created the issue: keep the pending record for manual review.
    return fail(
      'MITIGATION_PENDING',
      "Jira didn't confirm whether the issue was created. Check Jira for this commitment before trying again.",
    );
  }

  const created: MitigationReference = { ...pending, state: 'created', jiraIssueId: outcome.id, jiraIssueKey: outcome.key };
  const view = toMitigationView(created, siteBaseUrl);
  if (!view) return fail('INTERNAL', MESSAGES.internal);
  try {
    await putMitigation(created);
    return ok({ mitigation: view, referenceSaved: true });
  } catch {
    // The Jira issue exists but RippleGuard couldn't record it. The stored record
    // stays pending, so no further attempt is allowed without the owner's review.
    return ok({ mitigation: view, referenceSaved: false });
  }
}
