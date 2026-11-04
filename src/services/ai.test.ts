import { describe, expect, it, vi } from 'vitest';
import type { RiskSnapshot } from '../domain/model';

vi.mock('@forge/llm', () => ({ chat: vi.fn() }));
const { chat } = await import('@forge/llm');
const { explainRisk, isGroundedExplanation, rulesExplanation } = await import('./ai');

const snapshot: Pick<RiskSnapshot, 'status' | 'reasons' | 'evaluatedForDate'> = {
  status: 'at_risk',
  evaluatedForDate: '2026-11-04',
  reasons: [
    {
      code: 'ISSUE_DUE_AFTER_PROMISE',
      evidence: [{ issueId: '1', issueKey: 'RG-1', dueDate: '2026-12-10', statusName: 'In Progress' }],
    },
  ],
};
const facts = { title: 'Deliver SSO', promisedDate: '2026-11-30', snapshot };

const llmReply = (content: string) =>
  vi.mocked(chat).mockResolvedValueOnce({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }] });

describe('rule-based explanation', () => {
  it('states the facts from reason codes', () => {
    expect(rulesExplanation(facts)).toBe('RG-1 is due 2026-12-10, after the promised date 2026-11-30.');
  });
});

describe('grounding checks (ARCHITECTURE §G)', () => {
  it('accepts text that only uses supplied keys and dates', () => {
    expect(isGroundedExplanation('RG-1 is due 2026-12-10, after the 2026-11-30 promise, so it is at risk.', facts)).toBe(true);
  });

  it('rejects invented issue keys, dates, links and other statuses', () => {
    expect(isGroundedExplanation('RG-2 is late.', facts)).toBe(false);
    expect(isGroundedExplanation('RG-1 slips to 2027-01-01.', facts)).toBe(false);
    expect(isGroundedExplanation('See https://evil.example.com', facts)).toBe(false);
    expect(isGroundedExplanation('Overall this is on track.', facts)).toBe(false);
  });
});

describe('F04-T13 LLM failure never changes the facts', () => {
  it('uses grounded AI wording when valid', async () => {
    llmReply('RG-1 is due on 2026-12-10, which is after the promised date of 2026-11-30.');
    expect(await explainRisk(facts)).toEqual({
      text: 'RG-1 is due on 2026-12-10, which is after the promised date of 2026-11-30.',
      source: 'ai',
    });
  });

  it('falls back to rules when the LLM fails', async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error('LLM disabled'));
    expect(await explainRisk(facts)).toEqual({ text: rulesExplanation(facts), source: 'rules' });
  });

  it('falls back to rules when the LLM invents facts', async () => {
    llmReply('RG-9 will slip to 2027-02-01.');
    expect((await explainRisk(facts)).source).toBe('rules');
  });
});
