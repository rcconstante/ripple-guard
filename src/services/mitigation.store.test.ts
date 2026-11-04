import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Commitment, IssueFact, RiskSnapshot } from '../domain/model';

/**
 * F06 duplicate-safety against the REAL store and mitigation service, using an
 * in-memory KVS that honours FAIL_IF_EXISTS and can fail chosen writes.
 * Only Jira and the risk refresh are faked.
 */

const kv = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  /** Fail the next `set` whose key matches; consumed once. */
  failNextSet: [] as Array<(key: string) => boolean>,
  /** Count of `set` calls so far, and an optional call number to fail. */
  setCount: 0,
  failSetAt: 0,
}));

vi.mock('@forge/kvs', () => ({
  kvs: {
    get: vi.fn(async (key: string) => (kv.data.has(key) ? structuredClone(kv.data.get(key)) : undefined)),
    set: vi.fn(async (key: string, value: unknown, options?: { keyPolicy?: string }) => {
      kv.setCount += 1;
      if (kv.setCount === kv.failSetAt) throw new Error('KVS unavailable');
      const index = kv.failNextSet.findIndex((match) => match(key));
      if (index >= 0) {
        kv.failNextSet.splice(index, 1);
        throw new Error('KVS unavailable');
      }
      if (options?.keyPolicy === 'FAIL_IF_EXISTS' && kv.data.has(key)) throw new Error('Key already exists');
      kv.data.set(key, structuredClone(value));
    }),
    delete: vi.fn(async (key: string) => {
      kv.data.delete(key);
    }),
  },
  WhereConditions: { beginsWith: () => ({}) },
}));
vi.mock('./jira', () => ({
  fetchIssueFacts: vi.fn(),
  findTaskIssueType: vi.fn(),
  createIssueAsUser: vi.fn(),
  isPlatformAuthError: vi.fn(() => false),
}));
vi.mock('./risk', () => ({ refreshRisk: vi.fn() }));

const jira = await import('./jira');
const risk = await import('./risk');
const store = await import('./store');
const { createMitigation, PENDING_REVIEW_MIN_AGE_MS } = await import('./mitigation');

const SITE = 'https://rippleguard-dev.atlassian.net';
const OWNER = { accountId: 'owner-1', installationId: 'ari:cloud:jira::site/abc', cloudId: 'abc' };
const T0 = new Date('2026-11-04T10:00:00.000Z');
const later = (ms: number) => new Date(T0.getTime() + ms);

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
  evaluatedAt: T0.toISOString(),
  evaluatedForDate: '2026-11-04',
  signature: 'sig-1',
  stale: false,
  staleSince: null,
  explanation: null,
};

const input = { commitmentId: commitment.id, summary: 'Mitigate', description: 'Facts', confirm: true as const };
const reviewed = { ...input, acknowledgePendingReview: true };
const attemptKey = (n: number) => `mitigation:${commitment.id}:${n}`;
const latest = () => store.getMitigation(commitment.id, OWNER.installationId);

beforeEach(() => {
  kv.data.clear();
  kv.failNextSet.length = 0;
  kv.setCount = 0;
  kv.failSetAt = 0;
  vi.mocked(jira.createIssueAsUser).mockReset();
  vi.mocked(jira.isPlatformAuthError).mockReturnValue(false);
  vi.mocked(jira.fetchIssueFacts).mockResolvedValue({ ok: true, facts: new Map([['10001', fact]]) });
  vi.mocked(jira.findTaskIssueType).mockResolvedValue({ kind: 'found', issueTypeId: '10002' });
  vi.mocked(risk.refreshRisk).mockResolvedValue(snapshot);
  kv.data.set(`commitment:${commitment.id}`, commitment);
});

describe('F06 mitigation attempts with real store writes', () => {
  it('a KVS failure while claiming leaves nothing behind, never calls Jira, and the next click works', async () => {
    kv.failNextSet.push((key) => key === attemptKey(1));
    await expect(createMitigation(OWNER, input, SITE, T0)).rejects.toThrow('KVS unavailable');
    expect(jira.createIssueAsUser).not.toHaveBeenCalled();
    expect(kv.data.has(attemptKey(1))).toBe(false);

    vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'created', id: '20001', key: 'RG-9' });
    const retry = await createMitigation(OWNER, input, SITE, later(1000));
    expect(retry).toMatchObject({ ok: true, data: { referenceSaved: true } });
    expect(await latest()).toMatchObject({ attempt: 1, state: 'created', jiraIssueKey: 'RG-9' });
  });

  it('failure between the claim and the outcome write (rejection) never blocks later retries', async () => {
    vi.mocked(jira.createIssueAsUser).mockResolvedValueOnce({ kind: 'rejected', status: 400, message: 'Bad request.' });
    // Claim of attempt 1 succeeds; recording "failed" on it then fails.
    kv.failNextSet.push((key) => key === attemptKey(1) && kv.data.has(key));

    const first = await createMitigation(OWNER, input, SITE, T0);
    expect(first).toMatchObject({ ok: false, error: { code: 'JIRA_CREATE_FAILED' } });
    expect(await latest()).toMatchObject({ attempt: 1, state: 'pending' });

    // Without review: blocked, and Jira is not called again.
    expect(await createMitigation(OWNER, input, SITE, later(5000))).toMatchObject({ ok: false, error: { code: 'MITIGATION_PENDING' } });
    expect(jira.createIssueAsUser).toHaveBeenCalledTimes(1);

    // After the owner's review, the next attempt number can still be claimed: not stuck.
    vi.mocked(jira.createIssueAsUser).mockResolvedValueOnce({ kind: 'created', id: '20002', key: 'RG-10' });
    const retry = await createMitigation(OWNER, reviewed, SITE, later(PENDING_REVIEW_MIN_AGE_MS + 1000));
    expect(retry).toMatchObject({ ok: true, data: { referenceSaved: true } });
    expect(await latest()).toMatchObject({ attempt: 2, state: 'created', jiraIssueKey: 'RG-10' });
  });

  it('failure between the claim and the outcome write (created) keeps the issue pending and never auto-retries', async () => {
    vi.mocked(jira.createIssueAsUser).mockResolvedValueOnce({ kind: 'created', id: '20001', key: 'RG-9' });
    kv.failNextSet.push((key) => key === attemptKey(1) && kv.data.has(key));

    const first = await createMitigation(OWNER, input, SITE, T0);
    expect(first).toMatchObject({ ok: true, data: { referenceSaved: false, mitigation: { jiraIssueKey: 'RG-9' } } });
    expect(await latest()).toMatchObject({ attempt: 1, state: 'pending' });

    expect(await createMitigation(OWNER, input, SITE, later(5000))).toMatchObject({ ok: false, error: { code: 'MITIGATION_PENDING' } });
    expect(jira.createIssueAsUser).toHaveBeenCalledTimes(1);
  });

  it('repeated failures between writes keep retries possible (attempt numbers keep advancing)', async () => {
    for (let n = 1; n <= 3; n += 1) {
      vi.mocked(jira.createIssueAsUser).mockResolvedValueOnce({ kind: 'unknown' });
      const result = await createMitigation(OWNER, reviewed, SITE, later(n * (PENDING_REVIEW_MIN_AGE_MS + 1000)));
      expect(result).toMatchObject({ ok: false, error: { code: 'MITIGATION_PENDING' } });
      expect(await latest()).toMatchObject({ attempt: n, state: 'pending' });
    }
    vi.mocked(jira.createIssueAsUser).mockResolvedValueOnce({ kind: 'created', id: '20004', key: 'RG-12' });
    const final = await createMitigation(OWNER, reviewed, SITE, later(4 * (PENDING_REVIEW_MIN_AGE_MS + 1000)));
    expect(final.ok).toBe(true);
    expect(await latest()).toMatchObject({ attempt: 4, state: 'created' });
  });

  it.each([1, 2, 3])(
    'a KVS failure on write #%i of a retry attempt never blocks the next reviewed retry',
    async (k) => {
      // Attempt 1: Jira gives no clear answer, so it stays pending.
      vi.mocked(jira.createIssueAsUser).mockResolvedValueOnce({ kind: 'unknown' });
      await createMitigation(OWNER, input, SITE, T0);

      // Reviewed retry: Jira rejects, and the k-th KVS write of this attempt fails.
      kv.failSetAt = kv.setCount + k;
      vi.mocked(jira.createIssueAsUser).mockReset();
      vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'rejected', status: 400, message: 'Bad request.' });
      await createMitigation(OWNER, reviewed, SITE, later(PENDING_REVIEW_MIN_AGE_MS + 1000)).catch(() => undefined);
      kv.failSetAt = 0;

      // A later reviewed retry must still be able to claim an attempt and reach Jira.
      vi.mocked(jira.createIssueAsUser).mockReset();
      vi.mocked(jira.createIssueAsUser).mockResolvedValue({ kind: 'created', id: '20009', key: 'RG-19' });
      const result = await createMitigation(OWNER, reviewed, SITE, later(3 * (PENDING_REVIEW_MIN_AGE_MS + 1000)));
      expect(result).toMatchObject({ ok: true, data: { mitigation: { jiraIssueKey: 'RG-19' } } });
      expect(jira.createIssueAsUser).toHaveBeenCalledTimes(1);
    },
  );

  it('concurrent confirms race for the same attempt: exactly one reaches Jira', async () => {
    let release: () => void = () => {};
    vi.mocked(jira.createIssueAsUser).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ kind: 'created', id: '20001', key: 'RG-9' });
        }),
    );
    const a = createMitigation(OWNER, input, SITE, T0);
    const b = createMitigation(OWNER, input, SITE, T0);
    await vi.waitFor(() => expect(jira.createIssueAsUser).toHaveBeenCalledTimes(1));
    release();
    const results = await Promise.all([a, b]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toMatchObject([{ error: { code: 'MITIGATION_PENDING' } }]);
    expect(jira.createIssueAsUser).toHaveBeenCalledTimes(1);
  });

  it('after a clean rejection the next attempt is 2, and a created mitigation blocks further ones', async () => {
    vi.mocked(jira.createIssueAsUser)
      .mockResolvedValueOnce({ kind: 'rejected', status: 403, message: 'No permission.' })
      .mockResolvedValueOnce({ kind: 'created', id: '20002', key: 'RG-10' });

    expect(await createMitigation(OWNER, input, SITE, T0)).toMatchObject({ ok: false, error: { code: 'JIRA_CREATE_FAILED' } });
    expect(await latest()).toMatchObject({ attempt: 1, state: 'failed' });

    expect((await createMitigation(OWNER, input, SITE, later(1000))).ok).toBe(true);
    expect(await latest()).toMatchObject({ attempt: 2, state: 'created' });

    expect(await createMitigation(OWNER, input, SITE, later(2000))).toMatchObject({ ok: false, error: { code: 'MITIGATION_EXISTS' } });
    expect(jira.createIssueAsUser).toHaveBeenCalledTimes(2);
  });
});
