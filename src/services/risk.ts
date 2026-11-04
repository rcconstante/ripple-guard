import { todayUTC } from '../domain/dates';
import type { Commitment, IssueFetch, RiskSnapshot } from '../domain/model';
import { evaluateRisk, riskInputSignature } from '../domain/riskEngine';
import { getRiskSnapshot, putRiskSnapshot } from './store';

/**
 * Recompute and persist a commitment's risk from a fresh Jira read (F04).
 *
 * - Not active: no evaluation (fulfilled/archived are shown by lifecycle only).
 * - Jira unavailable: keep the last stored snapshot, marked stale. Never invent
 *   a healthy status; with no previous snapshot the status is Needs review.
 * - Writes only when the signature, staleness or evaluation date changed, so
 *   duplicate or out-of-order events have no extra effect.
 */
export async function refreshRisk(
  commitment: Commitment,
  fetch: IssueFetch,
  now: Date = new Date(),
): Promise<RiskSnapshot | null> {
  if (commitment.lifecycle !== 'active') return null;

  const today = todayUTC(now);
  const nowIso = now.toISOString();
  const existing = await getRiskSnapshot(commitment.id, commitment.installationId);

  if (!fetch.ok) {
    if (existing) {
      if (existing.stale) return existing;
      const stale: RiskSnapshot = { ...existing, stale: true, staleSince: nowIso };
      await putRiskSnapshot(stale);
      return stale;
    }
    const placeholder: RiskSnapshot = {
      commitmentId: commitment.id,
      installationId: commitment.installationId,
      status: 'needs_review',
      reasons: [],
      evaluatedAt: nowIso,
      evaluatedForDate: today,
      signature: 'unverified',
      stale: true,
      staleSince: nowIso,
      explanation: null,
    };
    await putRiskSnapshot(placeholder);
    return placeholder;
  }

  const input = {
    promisedDate: commitment.promisedDate,
    lifecycle: commitment.lifecycle,
    linkedIssueIds: commitment.linkedIssueIds,
    facts: fetch.facts,
    today,
  };
  const evaluation = evaluateRisk(input);
  if (!evaluation) return null;
  const signature = riskInputSignature(input);

  if (existing && existing.signature === signature && !existing.stale && existing.evaluatedForDate === today) {
    return existing;
  }

  const snapshot: RiskSnapshot = {
    commitmentId: commitment.id,
    installationId: commitment.installationId,
    status: evaluation.status,
    reasons: evaluation.reasons,
    evaluatedAt: nowIso,
    evaluatedForDate: today,
    signature,
    stale: false,
    staleSince: null,
    explanation: existing?.explanation?.signature === signature ? existing.explanation : null,
  };
  await putRiskSnapshot(snapshot);
  return snapshot;
}
