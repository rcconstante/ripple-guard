import { describe, expect, it } from 'vitest';
import { parseIssueUpdatedEvent } from './events';

const event = (items: unknown, extra: Record<string, unknown> = {}) => ({
  eventType: 'avi:jira:updated:issue',
  issue: { id: '10001', key: 'RG-1', fields: {} },
  changelog: { items },
  ...extra,
});

describe('F03 issue-updated event filtering', () => {
  it('due date and status changes are relevant', () => {
    expect(parseIssueUpdatedEvent(event([{ field: 'duedate', from: '2026-11-20', to: '2026-12-10' }]))).toEqual({
      issueId: '10001',
      relevant: true,
    });
    expect(parseIssueUpdatedEvent(event([{ fieldId: 'status', fromString: 'To Do', toString: 'Blocked' }]))?.relevant).toBe(true);
  });

  it('F03-T03 irrelevant field changes are ignored', () => {
    expect(parseIssueUpdatedEvent(event([{ field: 'summary' }, { field: 'description' }]))?.relevant).toBe(false);
  });

  it('F03-T04 self-generated events are dropped', () => {
    expect(parseIssueUpdatedEvent(event([{ field: 'duedate' }], { selfGenerated: true }))).toBeNull();
  });

  it('missing changelog re-evaluates safely', () => {
    expect(parseIssueUpdatedEvent({ issue: { id: '10001' } })?.relevant).toBe(true);
  });

  it('rejects events without a valid issue id', () => {
    expect(parseIssueUpdatedEvent({ issue: { key: 'RG-1' } })).toBeNull();
    expect(parseIssueUpdatedEvent({ issue: { id: 'RG-1' } })).toBeNull();
    expect(parseIssueUpdatedEvent(null)).toBeNull();
  });

  it('accepts numeric issue ids', () => {
    expect(parseIssueUpdatedEvent({ issue: { id: 10001 }, changelog: { items: [{ field: 'status' }] } })?.issueId).toBe('10001');
  });
});
