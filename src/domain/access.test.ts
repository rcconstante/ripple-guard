import { describe, expect, it } from 'vitest';
import { decideReadAccess } from './access';
import type { Commitment, IssueFact } from './model';

const commitment: Commitment = {
  id: '3f2b8c9e-1d2a-4b3c-8d4e-5f6a7b8c9d0e',
  installationId: 'ari:cloud:jira::site/abc',
  title: 'Deliver SSO for Acme',
  customerLabel: 'Acme',
  ownerAccountId: 'owner-1',
  promisedDate: '2026-11-30',
  sourceUrl: 'https://rippleguard-dev.atlassian.net/wiki/x',
  evidenceExcerpt: 'We commit to SSO.',
  linkedIssueIds: ['1', '2'],
  lifecycle: 'active',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  fulfilledAt: null,
};

const fact = (issueId: string, readable = true): IssueFact => ({
  issueId,
  readable,
  key: readable ? `RG-${issueId}` : null,
  summary: null,
  statusName: null,
  statusCategory: null,
  dueDate: null,
  projectId: null,
  projectKey: null,
});

const fetched = (...facts: IssueFact[]) => ({ ok: true as const, facts: new Map(facts.map((f) => [f.issueId, f])) });

describe('F02-T03 / F03-T05 / F07-T04 read access', () => {
  it('grants access when every linked issue is readable by the caller', () => {
    expect(decideReadAccess(commitment, fetched(fact('1'), fact('2'))).level).toBe('full');
  });

  it('denies when ANY linked issue is not readable, for owners and viewers alike', () => {
    expect(decideReadAccess(commitment, fetched(fact('1'), fact('2', false)))).toEqual({
      level: 'denied',
      reason: 'not-visible',
    });
  });

  it('denies when a linked issue is missing from the read', () => {
    expect(decideReadAccess(commitment, fetched(fact('1'))).level).toBe('denied');
  });

  it('denies when Jira visibility cannot be verified', () => {
    expect(decideReadAccess(commitment, { ok: false, reason: 'unavailable' })).toEqual({
      level: 'denied',
      reason: 'unverifiable',
    });
  });

  it('denies a record without explicit links', () => {
    expect(decideReadAccess({ ...commitment, linkedIssueIds: [] }, fetched()).level).toBe('denied');
  });
});
