import type { Commitment, IssueFetch, IssueFact } from './model';

/**
 * F02 read authorization, decided from a fresh Jira read made AS THE CALLER.
 *
 * Anyone, the owner included, may read a commitment only if they can read
 * EVERY linked issue. If Jira cannot be reached, visibility cannot be
 * verified and the read is denied. Owner-only actions additionally check
 * `ownerAccountId`. Nothing here is cached: every request re-checks.
 */
export type ReadAccess =
  | { level: 'full'; facts: Map<string, IssueFact> }
  | { level: 'denied'; reason: 'not-visible' | 'unverifiable' };

export function decideReadAccess(commitment: Commitment, fetch: IssueFetch): ReadAccess {
  if (!fetch.ok) return { level: 'denied', reason: 'unverifiable' };
  if (commitment.linkedIssueIds.length === 0) return { level: 'denied', reason: 'not-visible' };

  const facts = new Map<string, IssueFact>();
  for (const id of commitment.linkedIssueIds) {
    const fact = fetch.facts.get(id);
    if (!fact || !fact.readable) return { level: 'denied', reason: 'not-visible' };
    facts.set(id, fact);
  }
  return { level: 'full', facts };
}
