/**
 * Resolver contract shared by the Forge backend (src/) and the Custom UI
 * (static/rippleguard-ui). Types only, no runtime imports: this file is
 * compiled by both the Forge bundler (TypeScript 5.9) and the frontend (TypeScript 7).
 *
 * Backend:  makeResolver<RippleGuardApi>(resolvers)   (src/index.ts)
 * Frontend: makeInvoke<RippleGuardApi>()              (static/rippleguard-ui/src/lib/backend.ts)
 *
 * Vocabulary and rules: docs/FEATURE_SCOPE.md (F01–F08). Do not add fields
 * that are not in the scope document.
 */

// ---------------------------------------------------------------------------
// Domain vocabulary (FEATURE_SCOPE §D)
// ---------------------------------------------------------------------------

export type RiskStatus = 'on_track' | 'at_risk' | 'overdue' | 'needs_review';

export type Lifecycle = 'active' | 'fulfilled' | 'archived';

/** F04 reason codes. Every applicable code within the winning status is reported. */
export type ReasonCode =
  | 'PROMISE_DATE_PASSED'
  | 'ISSUE_DUE_AFTER_PROMISE'
  | 'EXPLICIT_BLOCKED_STATUS'
  | 'MISSING_ISSUE_DUE_DATE'
  | 'ISSUE_NOT_READABLE'
  | 'WORK_DONE_AWAITING_CONFIRMATION';

/** Jira status category key; `unknown` when Jira returns something else. */
export type StatusCategory = 'new' | 'indeterminate' | 'done' | 'unknown';

/** A Jira issue fact that supports a reason code. Dates are `YYYY-MM-DD`. */
export interface ReasonEvidence {
  issueId: string;
  /** Null when the issue is not readable. */
  issueKey: string | null;
  dueDate: string | null;
  statusName: string | null;
}

export interface RiskReason {
  code: ReasonCode;
  /** Source issues for the reason. Empty for PROMISE_DATE_PASSED. */
  evidence: ReasonEvidence[];
}

export interface RiskView {
  status: RiskStatus;
  reasons: RiskReason[];
  /** ISO timestamp of the evaluation. */
  evaluatedAt: string;
  /** UTC date (`YYYY-MM-DD`) the evaluation used as "today". */
  evaluatedForDate: string;
  /** True: show "Stale — could not verify current Jira data". */
  stale: boolean;
}

export interface LinkedIssueView {
  id: string;
  /** False when the current user (or the app, for stored snapshots) cannot read the issue. */
  readable: boolean;
  key: string | null;
  summary: string | null;
  statusName: string | null;
  statusCategory: StatusCategory | null;
  dueDate: string | null;
  projectKey: string | null;
  /** Browser link to the issue on this site. */
  url: string | null;
}

export interface CommitmentSummary {
  id: string;
  title: string;
  customerLabel: string;
  promisedDate: string;
  lifecycle: Lifecycle;
  isOwner: boolean;
  /** Null when the commitment is not active (fulfilled/archived are not evaluated). */
  risk: RiskView | null;
  issues: LinkedIssueView[];
}

export interface MitigationView {
  /** `pending`: a create attempt started but RippleGuard could not confirm the result. */
  state: 'created' | 'pending';
  jiraIssueId: string | null;
  jiraIssueKey: string | null;
  url: string | null;
  createdAt: string;
  createdByAccountId: string;
  /** For `pending`: Jira search link to find a possibly created issue (manual reconciliation). */
  reconcileSearchUrl: string | null;
}

export interface CommitmentPermissions {
  canEdit: boolean;
  canFulfill: boolean;
  canArchive: boolean;
  /** True only when F06 conditions hold (owner, active, At risk/Overdue, no existing mitigation). */
  canCreateMitigation: boolean;
}

export interface RiskExplanation {
  text: string;
  /** `ai`: Forge LLM wording, validated against the facts. `rules`: deterministic wording. */
  source: 'ai' | 'rules';
}

export interface CommitmentDetail extends CommitmentSummary {
  sourceUrl: string;
  /** User-attested evidence. Render as plain text, labelled "Recorded excerpt". */
  evidenceExcerpt: string;
  ownerAccountId: string;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
  explanation: RiskExplanation | null;
  mitigation: MitigationView | null;
  permissions: CommitmentPermissions;
}

/** Create/edit form payload (F02 fields; everything else is generated). */
export interface CommitmentInput {
  title: string;
  customerLabel: string;
  promisedDate: string;
  sourceUrl: string;
  evidenceExcerpt: string;
  linkedIssueIds: string[];
}

export interface IssueLookupResult {
  id: string;
  key: string;
  summary: string;
  statusName: string | null;
  dueDate: string | null;
  projectKey: string | null;
  url: string;
}

export interface IssueCommitmentItem {
  id: string;
  title: string;
  promisedDate: string;
  lifecycle: Lifecycle;
  risk: RiskView | null;
}

export interface IssueCommitmentsView {
  issueId: string;
  commitments: IssueCommitmentItem[];
}

export interface GraphContextNode {
  /** Stable node id for rendering. */
  id: string;
  type: 'confluence_page';
  title: string;
  url: string;
}

export interface GraphContext {
  status: 'available' | 'unavailable';
  nodes: GraphContextNode[];
  /** When unavailable: "Additional Teamwork Graph context unavailable". */
  message: string | null;
}

export interface ImpactGraphView {
  commitment: {
    id: string;
    title: string;
    customerLabel: string;
    promisedDate: string;
    lifecycle: Lifecycle;
    sourceUrl: string;
    risk: RiskView | null;
  };
  /** Edges labelled "Linked by user". */
  linkedIssues: LinkedIssueView[];
  /** Nodes labelled "Graph-suggested context". Never affect risk. */
  graphContext: GraphContext;
}

export interface MitigationDraft {
  commitmentId: string;
  projectId: string;
  projectKey: string;
  issueTypeId: string;
  issueTypeName: 'Task';
  summary: string;
  /** Plain text; converted to Atlassian Document Format on create. */
  description: string;
  reasonCodes: ReasonCode[];
}

export interface CreateMitigationInput {
  commitmentId: string;
  summary: string;
  description: string;
  /** Must be true: set only by the "Confirm create issue" button. */
  confirm: true;
  /**
   * Only for a `pending` mitigation: the owner confirms they checked Jira and
   * no mitigation issue exists, so a new attempt is allowed.
   */
  acknowledgePendingReview?: boolean;
}

export interface CreateMitigationResult {
  mitigation: MitigationView;
  /** False: the issue was created but the reference could not be stored. Show a recovery notice. */
  referenceSaved: boolean;
}

// ---------------------------------------------------------------------------
// Results and errors
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'NOT_OWNER'
  | 'ISSUE_NOT_ACCESSIBLE'
  | 'JIRA_UNAVAILABLE'
  | 'INVALID_STATE'
  | 'UNSUPPORTED_PROJECT'
  | 'MITIGATION_EXISTS'
  | 'MITIGATION_PENDING'
  | 'JIRA_CREATE_FAILED'
  | 'CONTEXT_UNAVAILABLE'
  | 'INTERNAL';

export type FieldErrors = Partial<Record<keyof CommitmentInput, string>>;

export interface AppError {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export interface CommitmentList {
  commitments: CommitmentSummary[];
}

// ---------------------------------------------------------------------------
// Resolver definitions (docs/ARCHITECTURE.md §D)
// ---------------------------------------------------------------------------

export type RippleGuardApi = {
  /** `active`: dashboard (F01). `all`: Commitments list (F02). */
  listCommitments: (input: { scope: 'active' | 'all' }) => Result<CommitmentList>;
  getCommitment: (input: { id: string }) => Result<CommitmentDetail>;
  createCommitment: (input: CommitmentInput) => Result<{ id: string }>;
  updateCommitment: (input: { id: string; changes: CommitmentInput }) => Result<{ id: string }>;
  fulfillCommitment: (input: { id: string; confirm: true }) => Result<{ id: string }>;
  archiveCommitment: (input: { id: string; confirm: true }) => Result<{ id: string }>;
  /** F03: find one issue by key or same-site URL and confirm the caller can read it. */
  lookupIssue: (input: { query: string }) => Result<IssueLookupResult>;
  /** F03 issue panel: uses the issue from the module context, never a client-supplied id. */
  getIssueCommitments: () => Result<IssueCommitmentsView>;
  getImpactGraph: (input: { id: string }) => Result<ImpactGraphView>;
  previewMitigation: (input: { id: string }) => Result<MitigationDraft>;
  createMitigation: (input: CreateMitigationInput) => Result<CreateMitigationResult>;
};

// ---------------------------------------------------------------------------
// Exact UI vocabulary (FEATURE_SCOPE §D). Use these strings verbatim.
// ---------------------------------------------------------------------------

export const RISK_LABELS: Record<RiskStatus, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  overdue: 'Overdue',
  needs_review: 'Needs review',
};

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  active: 'Active',
  fulfilled: 'Fulfilled',
  archived: 'Archived',
};

export const EVIDENCE_LABELS = {
  recordedExcerpt: 'Recorded excerpt',
  linkedByUser: 'Linked by user',
  graphSuggested: 'Graph-suggested context',
  stale: 'Stale — could not verify current Jira data',
  graphUnavailable: 'Additional Teamwork Graph context unavailable',
} as const;

/** Plain-language meaning of each reason code, for UI and Rovo answers. */
export const REASON_LABELS: Record<ReasonCode, string> = {
  PROMISE_DATE_PASSED: 'The promised date has passed',
  ISSUE_DUE_AFTER_PROMISE: 'A linked issue is due after the promised date',
  EXPLICIT_BLOCKED_STATUS: 'A linked issue has the status Blocked',
  MISSING_ISSUE_DUE_DATE: 'A linked issue has no due date',
  ISSUE_NOT_READABLE: 'A linked issue could not be read',
  WORK_DONE_AWAITING_CONFIRMATION: 'All linked work is done; the owner has not marked the commitment fulfilled',
};
