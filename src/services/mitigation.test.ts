import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Commitment, IssueFact, MitigationReference, RiskSnapshot } from '../domain/model';

vi.mock('./store', () => ({
  getCommitment: vi.fn(),
  getMitigation: vi.fn(),
  claimMitigationAttempt: vi.fn(),
  putMitigation: vi.fn(),
  MAX_MITIGATION_ATTEMPTS: 25,
}));
vi.mock('./jira', () => ({
  fetchIssueFacts: vi.fn(),
  findTaskIssueType: vi.fn(),
  createIssueAsUser: vi.fn(),
  isPlatformAuthError: vi.fn(() => false),
}));
vi.mock('./risk', () => ({ refreshRisk: vi.fn() }));

const store = await import('./store');
const jira = await import('./jira');
const risk = await import('./risk');
const { createMitigation, previewMitigation, PENDING_REVIEW_MIN_AGE_MS } = await import('./mitigation');

const SITE = 'https://rippleguard-dev.atlassian.net';
const OWNER = { accountId: 'owner-1', installationId: 'ari:cloud:jira::site/abc', cloudId: 'abc' };
const NOW = new Date('2026-11-04T10:00:00.000Z');

const commitment: Commitment = {
  id: '3f2b8c9e-1d2a-4b3c-8d4e-5f6a7b8c9d0e',
  installationId: OWNER.installationId,
  title: 'Deliver SSO for Acme',
  customerLabel: 'Acme',
  ownerAccountId: OWNER.accountId,
  promisedDate: '2026-11-30',
  sourceUrl: `${SITE}/wiki/spaces/S/pages/1/Promise`,
  evidenceExcerpt: 'We commit to SSO by November.',
  linkedIssueIds: ['10001'],
  lifecycle: 'active',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  fulfilledAt: null,
};
const fact: IssueFact = {
  issueId: '10001',
  readable: true,
  key: 'RG-1',
  summary: 'Build SSO',
  statusName: 'In Progress',
  statusCategory: 'indeterminate',
  dueDate: '2026-12-10',
  projectId: '10000',
  projectKey: 'RG',
};
const snapshot: RiskSnapshot = {
  commitmentId: commitment.id,
  installationId: OWNER.installationId,
  status: 'at_risk',
  reasons: [{ code: 'ISSUE_DUE_AFTER_PROMISE', evidence: [{ issueId: '10001', issueKey: 'RG-1', dueDate: '2026-12-10', statusName: 'In Progress' }] }],
  evaluatedAt: NOW.toISOString(),
  evaluatedForDate: '2026-11-04',
  signature: 'sig-1',
  stale: false,
  staleSince: null,
  explanation: null,
};
const input = { commitmentId: commitment.id, summary: 'Mitigate', description: 'Facts', confirm: true as const };

const pendingRef = (overrides: Partial<MitigationReference> = {}): MitigationReference => ({
  commitmentId: commitment.id,
  installationId: OWNER.installationId,
  state: 'pending',
  attempt: 1,
  jiraIssueId: null,
  jiraIssueKey: null,
  createdByAccountId: OWNER.accountId,
  createdAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
  riskFingerprint: 'sig-1',
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(jira.isPlatformAuthError).mockReturnValue(false);
  vi.mocked(store.getCommitment).mockResolvedValue(commitment);
  vi.mocked(store.getMitigation).mockResolvedValue(null);
  vi.mocked(store.claimMitigationAttempt).mockResolvedValue(true);
  vi.mocked(jira.fetchIssueFacts).mockResolvedValue({ ok: true, facts: new Map([['10001', fact]]) });
  vi.mocked(jira.findTaskIssueType).mockResolvedValue({ kind: 'found', issueTypeId: '10002' });
  vi.mocked(risk.refreshRisk).mockResolvedValue(snapshot);
});

describe('F06 mitigation service', () => {
  it('F06-T02 preview never calls Jira create or claims the slot', async () => {
    const result = await previewMitigation(OWNER, commitment.id, SITE);
    expect(result.ok).toBe(true);
    expect(jira.createIssueAsUser).not.toHaveBeenCalled();
    expect(store.claimMitigationAttempt).not.toHaveBeenCalled();
  });

  it('creates once and records the reference', async () => {
    vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'created', id: '20001', key: 'RG-9' });
    const result = await createMitigation(OWNER, input, SITE, NOW);
    expect(result).toMatchObject({ ok: true, data: { referenceSaved: true, mitigation: { state: 'created', jiraIssueKey: 'RG-9' } } });
    expect(store.claimMitigationAttempt).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, state: 'pending' }));
    expect(store.putMitigation).toHaveBeenCalledWith(expect.objectContaining({ state: 'created', jiraIssueId: '20001' }));
  });

  it('F06-T04 an existing mitigation blocks another', async () => {
    vi.mocked(store.getMitigation).mockResolvedValue(pendingRef({ state: 'created', jiraIssueKey: 'RG-9' }));
    const result = await createMitigation(OWNER, input, SITE, NOW);
    expect(result).toMatchObject({ ok: false, error: { code: 'MITIGATION_EXISTS' } });
    expect(jira.createIssueAsUser).not.toHaveBeenCalled();
  });

  it('a concurrent click that loses the atomic claim never calls Jira', async () => {
    vi.mocked(store.claimMitigationAttempt).mockResolvedValue(false);
    vi.mocked(store.getMitigation).mockResolvedValueOnce(null).mockResolvedValueOnce(pendingRef({ createdAt: NOW.toISOString() }));
    const result = await createMitigation(OWNER, input, SITE, NOW);
    expect(result).toMatchObject({ ok: false, error: { code: 'MITIGATION_PENDING' } });
    expect(jira.createIssueAsUser).not.toHaveBeenCalled();
  });

  it('unknown Jira outcome keeps the slot pending and never claims "not created"', async () => {
    vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'unknown' });
    const result = await createMitigation(OWNER, input, SITE, NOW);
    expect(result).toMatchObject({ ok: false, error: { code: 'MITIGATION_PENDING' } });
    if (!result.ok) expect(result.error.message).not.toMatch(/No issue was created/);
    expect(store.putMitigation).not.toHaveBeenCalled();
  });

  it('F06-T03/T06 a definite Jira rejection releases the slot as failed', async () => {
    vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'rejected', status: 403, message: 'No permission.' });
    const result = await createMitigation(OWNER, input, SITE, NOW);
    expect(result).toMatchObject({ ok: false, error: { code: 'JIRA_CREATE_FAILED' } });
    expect(store.putMitigation).toHaveBeenCalledWith(expect.objectContaining({ state: 'failed', attempt: 1 }));
  });

  it('after a failed attempt, the next attempt claims attempt 2 atomically', async () => {
    vi.mocked(store.getMitigation).mockResolvedValue(pendingRef({ state: 'failed', attempt: 1 }));
    vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'created', id: '20002', key: 'RG-10' });
    await createMitigation(OWNER, input, SITE, NOW);
    expect(store.claimMitigationAttempt).toHaveBeenCalledWith(expect.objectContaining({ attempt: 2 }));
  });

  it('a pending attempt needs the owner review before retrying', async () => {
    vi.mocked(store.getMitigation).mockResolvedValue(pendingRef());
    const result = await createMitigation(OWNER, input, SITE, NOW);
    expect(result).toMatchObject({ ok: false, error: { code: 'MITIGATION_PENDING' } });
    expect(store.claimMitigationAttempt).not.toHaveBeenCalled();
  });

  it('a reviewed pending attempt is retried only when old enough, with the next attempt number', async () => {
    vi.mocked(store.getMitigation).mockResolvedValue(
      pendingRef({ createdAt: new Date(NOW.getTime() - PENDING_REVIEW_MIN_AGE_MS + 1000).toISOString() }),
    );
    const young = await createMitigation(OWNER, { ...input, acknowledgePendingReview: true }, SITE, NOW);
    expect(young).toMatchObject({ ok: false, error: { code: 'MITIGATION_PENDING' } });
    expect(store.claimMitigationAttempt).not.toHaveBeenCalled();

    vi.mocked(store.getMitigation).mockResolvedValue(pendingRef({ attempt: 3 }));
    vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'created', id: '20003', key: 'RG-11' });
    const old = await createMitigation(OWNER, { ...input, acknowledgePendingReview: true }, SITE, NOW);
    expect(old.ok).toBe(true);
    expect(store.claimMitigationAttempt).toHaveBeenCalledWith(expect.objectContaining({ attempt: 4 }));
  });

  it('reference write failure reports the created issue with a recovery notice', async () => {
    vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'created', id: '20001', key: 'RG-9' });
    vi.mocked(store.putMitigation).mockRejectedValue(new Error('kvs down'));
    const result = await createMitigation(OWNER, input, SITE, NOW);
    expect(result).toMatchObject({ ok: true, data: { referenceSaved: false } });
  });

  it('only the owner can create, and unreadable links deny access', async () => {
    const viewer = { ...OWNER, accountId: 'viewer-2' };
    expect(await createMitigation(viewer, input, SITE, NOW)).toMatchObject({ ok: false, error: { code: 'NOT_OWNER' } });

    vi.mocked(jira.fetchIssueFacts).mockResolvedValue({ ok: true, facts: new Map([['10001', { ...fact, readable: false }]]) });
    expect(await createMitigation(OWNER, input, SITE, NOW)).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(jira.createIssueAsUser).not.toHaveBeenCalled();
  });

  it('F06-T05 not offered unless At risk or Overdue', async () => {
    vi.mocked(risk.refreshRisk).mockResolvedValue({ ...snapshot, status: 'on_track', reasons: [] });
    expect(await createMitigation(OWNER, input, SITE, NOW)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });
});
