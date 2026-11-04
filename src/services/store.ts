import { kvs, WhereConditions } from '@forge/kvs';
import type { Commitment, MitigationReference, RiskSnapshot } from '../domain/model';

/**
 * Forge KVS persistence (docs/ARCHITECTURE.md §C). KVS data is already
 * installation-scoped by the platform; every record also carries
 * `installationId` and reads reject records from another installation.
 *
 *   commitment:<id>                          Commitment
 *   risk:<commitmentId>                      RiskSnapshot
 *   mitigation:<commitmentId>:<attempt>      MitigationReference, one key per attempt (F06)
 *   issue-index:<jiraIssueId>:<commitmentId> { commitmentId }
 *
 * The issue index uses one key per (issue, commitment) pair instead of one
 * array per issue, so concurrent edits cannot lose each other's entries.
 * Index entries exist only for active commitments.
 */

const PAGE_SIZE = 100;

export const keys = {
  commitment: (id: string) => `commitment:${id}`,
  risk: (commitmentId: string) => `risk:${commitmentId}`,
  mitigation: (commitmentId: string, attempt: number) => `mitigation:${commitmentId}:${attempt}`,
  issueIndex: (issueId: string, commitmentId: string) => `issue-index:${issueId}:${commitmentId}`,
  issueIndexPrefix: (issueId: string) => `issue-index:${issueId}:`,
};

async function listByPrefix<T>(prefix: string): Promise<T[]> {
  const values: T[] = [];
  let cursor: string | undefined;
  do {
    let query = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(PAGE_SIZE);
    if (cursor) query = query.cursor(cursor);
    const page = await query.getMany<T>();
    values.push(...page.results.map((r) => r.value));
    cursor = page.nextCursor;
  } while (cursor);
  return values;
}

// ---------------------------------------------------------------------------
// Commitments
// ---------------------------------------------------------------------------

export async function getCommitment(id: string, installationId: string): Promise<Commitment | null> {
  const record = await kvs.get<Commitment>(keys.commitment(id));
  return record && record.installationId === installationId ? record : null;
}

export async function listCommitments(installationId: string): Promise<Commitment[]> {
  const records = await listByPrefix<Commitment>('commitment:');
  return records.filter((c) => c.installationId === installationId);
}

/**
 * Save a commitment and bring its issue-index entries in line, in one KVS
 * transaction (max 25 operations: 1 commitment + up to 20 index changes).
 */
export async function saveCommitment(next: Commitment, previous: Commitment | null): Promise<void> {
  const before = previous?.lifecycle === 'active' ? new Set(previous.linkedIssueIds) : new Set<string>();
  const after = next.lifecycle === 'active' ? new Set(next.linkedIssueIds) : new Set<string>();

  let tx = kvs.transact().set(keys.commitment(next.id), next);
  for (const issueId of after) {
    if (!before.has(issueId)) tx = tx.set(keys.issueIndex(issueId, next.id), { commitmentId: next.id });
  }
  for (const issueId of before) {
    if (!after.has(issueId)) tx = tx.delete(keys.issueIndex(issueId, next.id));
  }
  await tx.execute();
}

/** Commitment ids that explicitly link an issue (eventually consistent). */
export async function commitmentIdsForIssue(issueId: string): Promise<string[]> {
  const entries = await listByPrefix<{ commitmentId?: unknown }>(keys.issueIndexPrefix(issueId));
  const ids = entries.map((e) => e.commitmentId).filter((v): v is string => typeof v === 'string');
  return [...new Set(ids)];
}

export async function removeIssueIndexEntry(issueId: string, commitmentId: string): Promise<void> {
  await kvs.delete(keys.issueIndex(issueId, commitmentId));
}

// ---------------------------------------------------------------------------
// Risk snapshots
// ---------------------------------------------------------------------------

export async function getRiskSnapshot(commitmentId: string, installationId: string): Promise<RiskSnapshot | null> {
  const snapshot = await kvs.get<RiskSnapshot>(keys.risk(commitmentId));
  return snapshot && snapshot.installationId === installationId ? snapshot : null;
}

export async function putRiskSnapshot(snapshot: RiskSnapshot): Promise<void> {
  await kvs.set(keys.risk(snapshot.commitmentId), snapshot);
}

// ---------------------------------------------------------------------------
// Mitigation references (F06)
// ---------------------------------------------------------------------------

/**
 * Mitigation attempts are stored one key per attempt: `mitigation:<commitmentId>:<n>`.
 * Claiming attempt n is a single conditional write (FAIL_IF_EXISTS) of the full
 * pending reference, so there is no second write that could fail and leave a
 * half-claimed state. Attempt n+1 is only ever claimed after attempt n was
 * read, so attempts are contiguous from 1 and the latest is found by reading
 * 1, 2, 3, ... until the first missing key (strongly consistent `get`s).
 */
export const MAX_MITIGATION_ATTEMPTS = 25;

/** The latest mitigation attempt for a commitment, or null if none was ever made. */
export async function getMitigation(commitmentId: string, installationId: string): Promise<MitigationReference | null> {
  let latest: MitigationReference | null = null;
  for (let attempt = 1; attempt <= MAX_MITIGATION_ATTEMPTS; attempt += 1) {
    const ref = await kvs.get<MitigationReference>(keys.mitigation(commitmentId, attempt));
    if (ref === undefined) break;
    latest = ref;
  }
  return latest && latest.installationId === installationId ? latest : null;
}

/**
 * Atomically claim attempt `pending.attempt` by creating its key.
 * Returns false when another request already claimed that attempt
 * (duplicate click, concurrent retry). Throws if KVS fails; nothing is half-written.
 */
export async function claimMitigationAttempt(pending: MitigationReference): Promise<boolean> {
  const key = keys.mitigation(pending.commitmentId, pending.attempt);
  try {
    await kvs.set(key, pending, { keyPolicy: 'FAIL_IF_EXISTS' });
    return true;
  } catch (error) {
    // The KVS docs don't name the "key exists" error; confirm by reading the key.
    if ((await kvs.get(key)) !== undefined) return false;
    throw error;
  }
}

/** Record the outcome of an attempt this request claimed (created / failed). */
export async function putMitigation(ref: MitigationReference): Promise<void> {
  await kvs.set(keys.mitigation(ref.commitmentId, ref.attempt), ref);
}
