import { describe, expect, it } from 'vitest';
import type { Lifecycle } from '../shared/contracts';
import { todayUTC } from './dates';
import type { IssueFact } from './model';
import { evaluateRisk, riskInputSignature, type RiskInput } from './riskEngine';

// docs/TEST_MATRIX.md "Risk engine truth table": todayUTC 2026-11-04.
const TODAY = '2026-11-04';

function issue(id: string, overrides: Partial<IssueFact> = {}): IssueFact {
  return {
    issueId: id,
    readable: true,
    key: `RG-${id}`,
    summary: `Issue ${id}`,
    statusName: 'In Progress',
    statusCategory: 'indeterminate',
    dueDate: '2026-11-20',
    projectId: '10000',
    projectKey: 'RG',
    ...overrides,
  };
}

function input(promisedDate: string, issues: IssueFact[], lifecycle: Lifecycle = 'active'): RiskInput {
  return {
    promisedDate,
    lifecycle,
    linkedIssueIds: issues.map((i) => i.issueId),
    facts: new Map(issues.map((i) => [i.issueId, i])),
    today: TODAY,
  };
}

const codes = (r: ReturnType<typeof evaluateRisk>) => r?.reasons.map((x) => x.code);

describe('F04 risk engine truth table', () => {
  it('F04-T01 due before promise, in progress → On track', () => {
    const r = evaluateRisk(input('2026-11-30', [issue('1', { dueDate: '2026-11-28' })]));
    expect(r).toEqual({ status: 'on_track', reasons: [] });
  });

  it('F04-T02 due after promise → At risk / ISSUE_DUE_AFTER_PROMISE', () => {
    const r = evaluateRisk(input('2026-11-30', [issue('1', { dueDate: '2026-12-10' })]));
    expect(r?.status).toBe('at_risk');
    expect(codes(r)).toEqual(['ISSUE_DUE_AFTER_PROMISE']);
    expect(r?.reasons[0]?.evidence).toEqual([
      { issueId: '1', issueKey: 'RG-1', dueDate: '2026-12-10', statusName: 'In Progress' },
    ]);
  });

  it('F04-T03 promise date passed → Overdue / PROMISE_DATE_PASSED', () => {
    const r = evaluateRisk(input('2026-11-03', [issue('1', { dueDate: '2026-11-02' })]));
    expect(r?.status).toBe('overdue');
    expect(codes(r)).toEqual(['PROMISE_DATE_PASSED']);
  });

  it('F04-T04 promise due today is not overdue → On track', () => {
    const r = evaluateRisk(input('2026-11-04', [issue('1', { dueDate: '2026-11-04' })]));
    expect(r?.status).toBe('on_track');
  });

  it('F04-T05 explicit Blocked status → At risk / EXPLICIT_BLOCKED_STATUS', () => {
    const r = evaluateRisk(
      input('2026-11-30', [issue('1', { statusName: 'Blocked', dueDate: '2026-11-25' })]),
    );
    expect(r?.status).toBe('at_risk');
    expect(codes(r)).toEqual(['EXPLICIT_BLOCKED_STATUS']);
  });

  it('F04-T05b Blocked comparison is case-insensitive but exact', () => {
    expect(evaluateRisk(input('2026-11-30', [issue('1', { statusName: 'BLOCKED' })]))?.status).toBe(
      'at_risk',
    );
    expect(
      evaluateRisk(input('2026-11-30', [issue('1', { statusName: 'Blocked by vendor' })]))?.status,
    ).toBe('on_track');
  });

  it('F04-T06 missing due date → Needs review / MISSING_ISSUE_DUE_DATE', () => {
    const r = evaluateRisk(input('2026-11-30', [issue('1', { dueDate: null })]));
    expect(r?.status).toBe('needs_review');
    expect(codes(r)).toEqual(['MISSING_ISSUE_DUE_DATE']);
  });

  it('F04-T07 all issues done, not fulfilled → Needs review / WORK_DONE_AWAITING_CONFIRMATION', () => {
    const r = evaluateRisk(
      input('2026-11-30', [
        issue('1', { statusName: 'Done', statusCategory: 'done', dueDate: '2026-11-10' }),
        issue('2', { statusName: 'Closed', statusCategory: 'done', dueDate: '2026-11-12' }),
      ]),
    );
    expect(r?.status).toBe('needs_review');
    expect(codes(r)).toEqual(['WORK_DONE_AWAITING_CONFIRMATION']);
  });

  it('F04-T08 overdue wins over a due date after the promise', () => {
    const r = evaluateRisk(input('2026-11-03', [issue('1', { dueDate: '2026-12-10' })]));
    expect(r?.status).toBe('overdue');
    expect(codes(r)).toEqual(['PROMISE_DATE_PASSED']);
  });

  it('F04-T09 inaccessible issue is never On track', () => {
    const r = evaluateRisk(input('2026-11-30', [issue('1', { readable: false })]));
    expect(r?.status).toBe('needs_review');
    expect(codes(r)).toEqual(['ISSUE_NOT_READABLE']);
    expect(r?.reasons[0]?.evidence).toEqual([
      { issueId: '1', issueKey: null, dueDate: null, statusName: null },
    ]);
  });

  it('F04-T09b linked id without any fact counts as not readable', () => {
    const r = evaluateRisk({
      promisedDate: '2026-11-30',
      lifecycle: 'active',
      linkedIssueIds: ['9'],
      facts: new Map(),
      today: TODAY,
    });
    expect(r?.status).toBe('needs_review');
    expect(codes(r)).toEqual(['ISSUE_NOT_READABLE']);
  });

  it('F04-T10 due date equal to promised date → On track', () => {
    const r = evaluateRisk(input('2026-11-30', [issue('1', { dueDate: '2026-11-30' })]));
    expect(r?.status).toBe('on_track');
  });

  it('F04-T11 fulfilled and archived are excluded', () => {
    expect(evaluateRisk(input('2026-11-03', [issue('1')], 'fulfilled'))).toBeNull();
    expect(evaluateRisk(input('2026-11-30', [issue('1')], 'archived'))).toBeNull();
  });

  it('reports every applicable reason in the winning class', () => {
    const r = evaluateRisk(
      input('2026-11-30', [
        issue('1', { dueDate: '2026-12-01' }),
        issue('2', { statusName: 'Blocked' }),
        issue('3', { dueDate: null }),
        issue('4', { readable: false }),
      ]),
    );
    expect(r?.status).toBe('at_risk');
    expect(codes(r)).toEqual(['ISSUE_DUE_AFTER_PROMISE', 'EXPLICIT_BLOCKED_STATUS']);

    const review = evaluateRisk(
      input('2026-11-30', [issue('3', { dueDate: null }), issue('4', { readable: false })]),
    );
    expect(codes(review)).toEqual(['ISSUE_NOT_READABLE', 'MISSING_ISSUE_DUE_DATE']);
  });

  it('a done issue among unfinished ones does not trigger WORK_DONE_AWAITING_CONFIRMATION', () => {
    const r = evaluateRisk(
      input('2026-11-30', [issue('1', { statusCategory: 'done' }), issue('2')]),
    );
    expect(r?.status).toBe('on_track');
  });

  it('no linked issues never yields On track', () => {
    expect(evaluateRisk(input('2026-11-30', []))?.status).toBe('needs_review');
  });
});

describe('F04-T12 UTC date boundary', () => {
  it('uses the UTC calendar date regardless of local offset', () => {
    // 23:30 at UTC-10 on Nov 3 is already Nov 4 in UTC.
    expect(todayUTC(new Date('2026-11-04T09:30:00Z'))).toBe('2026-11-04');
    expect(todayUTC(new Date('2026-11-03T23:59:59.999Z'))).toBe('2026-11-03');
    expect(todayUTC(new Date('2026-11-04T00:00:00.000Z'))).toBe('2026-11-04');
  });
});

describe('F04-T14 determinism and signatures', () => {
  it('same relevant inputs give the same state and signature', () => {
    const a = input('2026-11-30', [issue('1'), issue('2', { dueDate: '2026-12-02' })]);
    const b = input('2026-11-30', [issue('2', { dueDate: '2026-12-02' }), issue('1')]);
    expect(evaluateRisk(a)?.status).toBe(evaluateRisk(input('2026-11-30', [issue('1'), issue('2', { dueDate: '2026-12-02' })]))?.status);
    expect(riskInputSignature(a)).toBe(riskInputSignature({ ...b, linkedIssueIds: a.linkedIssueIds }));
  });

  it('irrelevant fields do not change the signature; relevant ones do', () => {
    const base = input('2026-11-30', [issue('1')]);
    const renamed = input('2026-11-30', [issue('1', { summary: 'Renamed', key: 'RG-99' })]);
    const moved = input('2026-11-30', [issue('1', { dueDate: '2026-12-01' })]);
    expect(riskInputSignature(renamed)).toBe(riskInputSignature(base));
    expect(riskInputSignature(moved)).not.toBe(riskInputSignature(base));
  });

  it('signature changes only when the promise date passes, not every day', () => {
    const day1 = { ...input('2026-11-30', [issue('1')]), today: '2026-11-04' };
    const day2 = { ...input('2026-11-30', [issue('1')]), today: '2026-11-05' };
    const passed = { ...input('2026-11-30', [issue('1')]), today: '2026-12-01' };
    expect(riskInputSignature(day1)).toBe(riskInputSignature(day2));
    expect(riskInputSignature(passed)).not.toBe(riskInputSignature(day1));
  });
});
