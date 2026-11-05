import { randomUUID } from 'node:crypto';
import type { Handlers } from '@forge/resolver';
import { decideReadAccess } from '../domain/access';
import type { Commitment, IssueFetch } from '../domain/model';
import { issueBrowseUrl, parseIssueReference } from '../domain/urls';
import { isConfirmed, validateCommitmentId, validateCommitmentInput, validateCreateMitigationInput } from '../domain/validation';
import { detailOf, loadAccessible, summaryOf, type AccessibleCommitment } from '../services/commitmentReads';
import { callerFromResolverContext, issueIdFromExtension, type Caller } from '../services/context';
import { graphContextFor } from '../services/graph';
import { fetchIssueFacts, getSiteBaseUrl, isPlatformAuthError, JiraUnavailableError, lookupIssueAsUser } from '../services/jira';
import { createMitigation, previewMitigation } from '../services/mitigation';
import { fail, MESSAGES, ok } from '../services/result';
import { refreshRisk } from '../services/risk';
import { commitmentIdsForIssue, getCommitment, listCommitments, removeIssueIndexEntry, saveCommitment } from '../services/store';
import type { Result, RippleGuardApi } from '../shared/contracts';

/**
 * Custom UI resolvers (docs/ARCHITECTURE.md §D). Every handler identifies the
 * caller from the Forge context, validates the payload server-side, and checks
 * Jira visibility as the caller (every linked issue must be readable) before
 * returning or changing anything.
 */

type Payload = Record<string, unknown> | undefined;

async function guarded<T>(context: unknown, run: (caller: Caller) => Promise<Result<T>>): Promise<Result<T>> {
  const caller = callerFromResolverContext(context);
  if (!caller) return fail('CONTEXT_UNAVAILABLE', MESSAGES.context);
  try {
    return await run(caller);
  } catch (error) {
    if (isPlatformAuthError(error)) throw error; // lets Forge ask the user to allow access
    if (error instanceof JiraUnavailableError) return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
    // Log only the error type: never payloads, excerpts, prompts or tokens.
    console.error('RippleGuard resolver failed', error instanceof Error ? error.name : typeof error);
    return fail('INTERNAL', MESSAGES.internal);
  }
}

function unreadableIdsError(ids: string[], fetch: IssueFetch) {
  if (!fetch.ok) return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
  const unreadable = ids.filter((id) => !fetch.facts.get(id)?.readable);
  if (unreadable.length === 0) return null;
  return fail('VALIDATION_FAILED', 'Check the highlighted fields.', {
    linkedIssueIds:
      unreadable.length === 1
        ? "One linked issue doesn't exist or you don't have permission to view it."
        : `${unreadable.length} linked issues don't exist or you don't have permission to view them.`,
  });
}

/** One readable commitment, or NOT_FOUND / JIRA_UNAVAILABLE. */
async function loadOne(caller: Caller, id: string): Promise<Result<AccessibleCommitment>> {
  const commitment = await getCommitment(id, caller.installationId);
  if (!commitment) return fail('NOT_FOUND', MESSAGES.notFound);
  const load = await loadAccessible([commitment]);
  if (!load.jiraAvailable) return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
  const item = load.items[0];
  return item ? ok(item) : fail('NOT_FOUND', MESSAGES.notFound);
}

/** Owner actions: the caller must own the record AND read every linked issue now. */
async function loadForOwnerAction(caller: Caller, id: string): Promise<Result<Commitment>> {
  const commitment = await getCommitment(id, caller.installationId);
  if (!commitment) return fail('NOT_FOUND', MESSAGES.notFound);
  const fetch = await fetchIssueFacts(commitment.linkedIssueIds, 'user');
  if (!fetch.ok) return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
  if (decideReadAccess(commitment, fetch).level === 'denied') return fail('NOT_FOUND', MESSAGES.notFound);
  if (commitment.ownerAccountId !== caller.accountId) return fail('NOT_OWNER', MESSAGES.notOwner);
  return ok(commitment);
}

export const resolvers: Handlers<RippleGuardApi> = {
  listCommitments: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const scope = (payload as Payload)?.scope;
      if (scope !== 'active' && scope !== 'all') return fail('VALIDATION_FAILED', 'Unknown list scope.');
      const siteBaseUrl = await getSiteBaseUrl(caller.installationId);
      const records = (await listCommitments(caller.installationId)).filter(
        (c) => scope === 'all' || c.lifecycle === 'active',
      );
      const load = await loadAccessible(records);
      if (!load.jiraAvailable) return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
      const commitments = load.items
        .map((item) => summaryOf(item, caller, siteBaseUrl))
        .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate) || a.title.localeCompare(b.title));
      return ok({ commitments });
    }),

  getCommitment: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const id = validateCommitmentId(payload);
      if (!id) return fail('NOT_FOUND', MESSAGES.notFound);
      const siteBaseUrl = await getSiteBaseUrl(caller.installationId);
      const item = await loadOne(caller, id);
      return item.ok ? ok(await detailOf(item.data, caller, siteBaseUrl)) : item;
    }),

  createCommitment: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const siteBaseUrl = await getSiteBaseUrl(caller.installationId);
      const input = validateCommitmentInput(payload, siteBaseUrl);
      if (!input.ok) return fail('VALIDATION_FAILED', input.message, input.fieldErrors);

      const fetch = await fetchIssueFacts(input.value.linkedIssueIds, 'user');
      const denied = unreadableIdsError(input.value.linkedIssueIds, fetch);
      if (denied) return denied;

      const now = new Date().toISOString();
      const commitment: Commitment = {
        id: randomUUID(),
        installationId: caller.installationId,
        ...input.value,
        ownerAccountId: caller.accountId,
        lifecycle: 'active',
        createdAt: now,
        updatedAt: now,
        fulfilledAt: null,
      };
      await saveCommitment(commitment, null);
      await refreshRisk(commitment, fetch);
      return ok({ id: commitment.id });
    }),

  updateCommitment: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const id = validateCommitmentId(payload);
      if (!id) return fail('NOT_FOUND', MESSAGES.notFound);
      const loaded = await loadForOwnerAction(caller, id);
      if (!loaded.ok) return loaded;
      const commitment = loaded.data;
      if (commitment.lifecycle !== 'active') return fail('INVALID_STATE', 'Only active commitments can be edited.');

      const siteBaseUrl = await getSiteBaseUrl(caller.installationId);
      const input = validateCommitmentInput((payload as Payload)?.changes, siteBaseUrl);
      if (!input.ok) return fail('VALIDATION_FAILED', input.message, input.fieldErrors);

      // Changing links revalidates access for the full new set (F02).
      const fetch = await fetchIssueFacts(input.value.linkedIssueIds, 'user');
      const denied = unreadableIdsError(input.value.linkedIssueIds, fetch);
      if (denied) return denied;

      const next: Commitment = { ...commitment, ...input.value, updatedAt: new Date().toISOString() };
      await saveCommitment(next, commitment);
      await refreshRisk(next, fetch); // F02-T04: edits trigger recalculation
      return ok({ id });
    }),

  fulfillCommitment: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const id = validateCommitmentId(payload);
      if (!id) return fail('NOT_FOUND', MESSAGES.notFound);
      if (!isConfirmed(payload)) return fail('VALIDATION_FAILED', 'Marking fulfilled needs explicit confirmation.');
      const loaded = await loadForOwnerAction(caller, id);
      if (!loaded.ok) return loaded;
      const commitment = loaded.data;
      if (commitment.lifecycle !== 'active') return fail('INVALID_STATE', 'Only active commitments can be marked fulfilled.');
      const now = new Date().toISOString();
      await saveCommitment({ ...commitment, lifecycle: 'fulfilled', fulfilledAt: now, updatedAt: now }, commitment);
      return ok({ id });
    }),

  archiveCommitment: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const id = validateCommitmentId(payload);
      if (!id) return fail('NOT_FOUND', MESSAGES.notFound);
      if (!isConfirmed(payload)) return fail('VALIDATION_FAILED', 'Archiving needs explicit confirmation.');
      const loaded = await loadForOwnerAction(caller, id);
      if (!loaded.ok) return loaded;
      const commitment = loaded.data;
      if (commitment.lifecycle === 'archived') return fail('INVALID_STATE', 'This commitment is already archived.');
      await saveCommitment({ ...commitment, lifecycle: 'archived', updatedAt: new Date().toISOString() }, commitment);
      return ok({ id });
    }),

  lookupIssue: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const query = (payload as Payload)?.query;
      if (typeof query !== 'string') return fail('VALIDATION_FAILED', 'Enter a Jira issue key or URL.');
      const siteBaseUrl = await getSiteBaseUrl(caller.installationId);
      const parsed = parseIssueReference(query, siteBaseUrl);
      if (!parsed.ok) return fail('VALIDATION_FAILED', parsed.message);

      const found = await lookupIssueAsUser(parsed.ref);
      if (found.kind === 'unavailable') return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
      if (found.kind === 'not-accessible' || !found.fact.key) {
        return fail('ISSUE_NOT_ACCESSIBLE', "That issue doesn't exist or you don't have permission to view it.");
      }
      const { fact } = found;
      const key = fact.key as string;
      return ok({
        id: fact.issueId,
        key,
        summary: fact.summary ?? '',
        statusName: fact.statusName,
        dueDate: fact.dueDate,
        projectKey: fact.projectKey,
        url: issueBrowseUrl(siteBaseUrl, key),
      });
    }),

  getIssueCommitments: ({ context }) =>
    guarded(context, async (caller) => {
      const issueId = issueIdFromExtension(context);
      if (!issueId) return fail('CONTEXT_UNAVAILABLE', 'Open RippleGuard from a Jira issue to see linked commitments.');

      const records: Commitment[] = [];
      for (const id of await commitmentIdsForIssue(issueId)) {
        const commitment = await getCommitment(id, caller.installationId);
        if (commitment?.lifecycle === 'active' && commitment.linkedIssueIds.includes(issueId)) {
          records.push(commitment);
        } else {
          await removeIssueIndexEntry(issueId, id); // archived, fulfilled, unlinked or deleted
        }
      }
      const load = await loadAccessible(records);
      if (!load.jiraAvailable) return fail('JIRA_UNAVAILABLE', MESSAGES.jiraUnavailable);
      return ok({
        issueId,
        commitments: load.items
          .map((item) => {
            const summary = summaryOf(item, caller, '');
            return {
              id: summary.id,
              title: summary.title,
              promisedDate: summary.promisedDate,
              lifecycle: summary.lifecycle,
              risk: summary.risk,
            };
          })
          .sort((a, b) => a.promisedDate.localeCompare(b.promisedDate)),
      });
    }),

  getImpactGraph: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const id = validateCommitmentId(payload);
      if (!id) return fail('NOT_FOUND', MESSAGES.notFound);
      const siteBaseUrl = await getSiteBaseUrl(caller.installationId);
      const loaded = await loadOne(caller, id);
      if (!loaded.ok) return loaded;
      const item = loaded.data;
      const summary = summaryOf(item, caller, siteBaseUrl);
      return ok({
        commitment: {
          id: item.commitment.id,
          title: item.commitment.title,
          customerLabel: item.commitment.customerLabel,
          promisedDate: item.commitment.promisedDate,
          lifecycle: item.commitment.lifecycle,
          sourceUrl: item.commitment.sourceUrl,
          risk: summary.risk,
        },
        linkedIssues: summary.issues,
        graphContext: await graphContextFor(item.commitment, item.facts, siteBaseUrl, caller.cloudId),
      });
    }),

  previewMitigation: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const id = validateCommitmentId(payload);
      if (!id) return fail('NOT_FOUND', MESSAGES.notFound);
      return previewMitigation(caller, id, await getSiteBaseUrl(caller.installationId));
    }),

  createMitigation: ({ payload, context }) =>
    guarded(context, async (caller) => {
      const input = validateCreateMitigationInput(payload);
      if (!input.ok) return fail('VALIDATION_FAILED', input.message);
      return createMitigation(caller, input.value, await getSiteBaseUrl(caller.installationId));
    }),
};
