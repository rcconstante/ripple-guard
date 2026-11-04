import type { Lifecycle, RiskReason, RiskStatus, StatusCategory } from '../shared/contracts';

/** Stored commitment record (FEATURE_SCOPE F02 field table; no extra fields). */
export interface Commitment {
  id: string;
  installationId: string;
  title: string;
  customerLabel: string;
  ownerAccountId: string;
  promisedDate: string;
  sourceUrl: string;
  evidenceExcerpt: string;
  linkedIssueIds: string[];
  lifecycle: Lifecycle;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
}

/**
 * Current state of one linked Jira issue as seen by a specific principal.
 * `readable: false` means Jira says the issue does not exist or the principal
 * cannot see it. Transient failures are not represented here (see IssueFetch).
 */
export interface IssueFact {
  issueId: string;
  readable: boolean;
  key: string | null;
  summary: string | null;
  statusName: string | null;
  statusCategory: StatusCategory | null;
  dueDate: string | null;
  projectId: string | null;
  projectKey: string | null;
}

/** Result of reading a set of issues from Jira. */
export type IssueFetch =
  | { ok: true; facts: Map<string, IssueFact> }
  /** Jira could not be reached or returned a retriable error: visibility is unknown. */
  | { ok: false; reason: 'unavailable' };

export interface RiskEvaluation {
  status: RiskStatus;
  reasons: RiskReason[];
}

/** Stored at `risk:<commitmentId>`. */
export interface RiskSnapshot {
  commitmentId: string;
  installationId: string;
  status: RiskStatus;
  reasons: RiskReason[];
  evaluatedAt: string;
  evaluatedForDate: string;
  /** Stable hash of the inputs that produced this evaluation (idempotency). */
  signature: string;
  stale: boolean;
  staleSince: string | null;
  /** Cached explanation for this exact signature, so the LLM is not called on every view. */
  explanation: { signature: string; text: string; source: 'ai' | 'rules' } | null;
}

/**
 * Stored at `mitigation:<commitmentId>` (F06).
 * - `pending`: an attempt is in progress, or its outcome is unknown (Jira may
 *   have created the issue). Only the owner's explicit review releases it.
 * - `created`: the one mitigation issue for this commitment.
 * - `failed`: Jira definitively rejected the last attempt; nothing was created.
 */
export interface MitigationReference {
  commitmentId: string;
  installationId: string;
  state: 'pending' | 'created' | 'failed';
  /** 1 for the first attempt; each retry claims the next number atomically. */
  attempt: number;
  jiraIssueId: string | null;
  jiraIssueKey: string | null;
  createdByAccountId: string;
  createdAt: string;
  /** Signature of the risk snapshot the mitigation was created for. */
  riskFingerprint: string;
}
