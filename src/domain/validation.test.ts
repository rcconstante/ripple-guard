import { describe, expect, it } from 'vitest';
import { confluencePageId, parseIssueReference, parseSameSiteUrl } from './urls';
import { validateCommitmentId, validateCommitmentInput, validateCreateMitigationInput } from './validation';

const SITE = 'https://rippleguard-dev.atlassian.net';

const valid = {
  title: 'Deliver SSO for Acme',
  customerLabel: 'Acme Corp',
  promisedDate: '2026-11-30',
  sourceUrl: `${SITE}/wiki/spaces/SALES/pages/123456/Acme+promise`,
  evidenceExcerpt: 'We commit to SSO by end of November.',
  linkedIssueIds: ['10001'],
};

describe('F02-T01 valid commitment input', () => {
  it('accepts all required fields with a same-site source URL and one issue', () => {
    const r = validateCommitmentInput(valid, SITE);
    expect(r.ok).toBe(true);
  });

  it('trims text fields', () => {
    const r = validateCommitmentInput({ ...valid, title: '  Deliver SSO for Acme  ' }, SITE);
    expect(r.ok && r.value.title).toBe('Deliver SSO for Acme');
  });
});

describe('F02-T02 rejects invalid input', () => {
  const errorsFor = (patch: Record<string, unknown>) => {
    const r = validateCommitmentInput({ ...valid, ...patch }, SITE);
    if (r.ok) throw new Error('expected validation failure');
    return r.fieldErrors;
  };

  it('missing fields', () => {
    expect(errorsFor({ title: '' }).title).toBeDefined();
    expect(errorsFor({ customerLabel: '   ' }).customerLabel).toBeDefined();
    expect(errorsFor({ promisedDate: undefined }).promisedDate).toBeDefined();
    expect(errorsFor({ sourceUrl: '' }).sourceUrl).toBeDefined();
    expect(errorsFor({ evidenceExcerpt: '' }).evidenceExcerpt).toBeDefined();
    expect(errorsFor({ linkedIssueIds: [] }).linkedIssueIds).toBeDefined();
  });

  it('length limits', () => {
    expect(errorsFor({ title: 'abcd' }).title).toMatch(/at least 5/);
    expect(errorsFor({ title: 'x'.repeat(141) }).title).toMatch(/at most 140/);
    expect(errorsFor({ customerLabel: 'x'.repeat(121) }).customerLabel).toBeDefined();
    expect(errorsFor({ evidenceExcerpt: 'too short' }).evidenceExcerpt).toMatch(/at least 10/);
    expect(errorsFor({ evidenceExcerpt: 'x'.repeat(1001) }).evidenceExcerpt).toMatch(/at most 1000/);
  });

  it('more than 10 issues, duplicates and malformed ids', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => String(10001 + i));
    expect(errorsFor({ linkedIssueIds: eleven }).linkedIssueIds).toMatch(/at most 10/);
    expect(errorsFor({ linkedIssueIds: ['10001', '10001'] }).linkedIssueIds).toMatch(/only once/);
    expect(errorsFor({ linkedIssueIds: ['PROJ-1'] }).linkedIssueIds).toBeDefined();
    expect(errorsFor({ linkedIssueIds: '10001' }).linkedIssueIds).toBeDefined();
  });

  it('invalid dates', () => {
    expect(errorsFor({ promisedDate: '2026-02-30' }).promisedDate).toBeDefined();
    expect(errorsFor({ promisedDate: '30/11/2026' }).promisedDate).toBeDefined();
    expect(errorsFor({ promisedDate: '2026-11-30T00:00:00Z' }).promisedDate).toBeDefined();
  });

  it('invalid or mismatched-site URLs', () => {
    expect(errorsFor({ sourceUrl: 'http://rippleguard-dev.atlassian.net/wiki' }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: 'https://evil.example.com/wiki' }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: 'https://other.atlassian.net/wiki' }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: 'https://rippleguard-dev.atlassian.net.evil.com/x' }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: 'https://user:pw@rippleguard-dev.atlassian.net/wiki' }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: 'javascript:alert(1)' }).sourceUrl).toBeDefined();
    expect(errorsFor({ sourceUrl: `${SITE}/${'a'.repeat(2001)}` }).sourceUrl).toBeDefined();
  });

  it('non-object payloads and control characters', () => {
    expect(validateCommitmentInput(null, SITE).ok).toBe(false);
    expect(validateCommitmentInput('x', SITE).ok).toBe(false);
    expect(errorsFor({ title: 'Deliver\u0000SSO' }).title).toBeDefined();
    expect(validateCommitmentInput({ ...valid, evidenceExcerpt: 'Line one\nLine two' }, SITE).ok).toBe(true);
  });
});

describe('issue references (F03 linking)', () => {
  it('parses keys, ids and same-site URLs', () => {
    expect(parseIssueReference('proj-12', SITE)).toEqual({ ok: true, ref: { kind: 'key', value: 'PROJ-12' } });
    expect(parseIssueReference('10001', SITE)).toEqual({ ok: true, ref: { kind: 'id', value: '10001' } });
    expect(parseIssueReference(`${SITE}/browse/RG-7`, SITE)).toEqual({ ok: true, ref: { kind: 'key', value: 'RG-7' } });
    expect(parseIssueReference(`${SITE}/jira/software/projects/RG/boards/1?selectedIssue=RG-8`, SITE)).toEqual({
      ok: true,
      ref: { kind: 'key', value: 'RG-8' },
    });
  });

  it('rejects cross-site and non-issue URLs', () => {
    expect(parseIssueReference('https://other.atlassian.net/browse/RG-7', SITE).ok).toBe(false);
    expect(parseIssueReference(`${SITE}/wiki/spaces/X`, SITE).ok).toBe(false);
    expect(parseIssueReference('not an issue', SITE).ok).toBe(false);
    expect(parseIssueReference('', SITE).ok).toBe(false);
  });
});

describe('URL helpers', () => {
  it('same-site parsing is case-insensitive on host only', () => {
    expect(parseSameSiteUrl('https://RippleGuard-Dev.atlassian.net/wiki', SITE)).not.toBeNull();
  });

  it('extracts Confluence page ids', () => {
    expect(confluencePageId(`${SITE}/wiki/spaces/S/pages/123456/Title`, SITE)).toBe('123456');
    expect(confluencePageId(`${SITE}/wiki/pages/viewpage.action?pageId=987`, SITE)).toBe('987');
    expect(confluencePageId(`${SITE}/browse/RG-1`, SITE)).toBeNull();
    expect(confluencePageId('https://other.atlassian.net/wiki/spaces/S/pages/1', SITE)).toBeNull();
  });
});

describe('ids and mitigation input', () => {
  it('accepts only UUID commitment ids', () => {
    expect(validateCommitmentId({ id: '3f2b8c9e-1d2a-4b3c-8d4e-5f6a7b8c9d0e' })).not.toBeNull();
    expect(validateCommitmentId({ id: 'commitment:1' })).toBeNull();
    expect(validateCommitmentId({})).toBeNull();
  });

  it('requires explicit confirmation to create a mitigation (F06-T02)', () => {
    const base = {
      commitmentId: '3f2b8c9e-1d2a-4b3c-8d4e-5f6a7b8c9d0e',
      summary: 'Mitigate',
      description: 'Facts',
    };
    expect(validateCreateMitigationInput(base).ok).toBe(false);
    expect(validateCreateMitigationInput({ ...base, confirm: 'true' }).ok).toBe(false);
    expect(validateCreateMitigationInput({ ...base, confirm: true }).ok).toBe(true);
  });
});
