import api, { NeedsAuthenticationError, route } from '@forge/api';
import { normalizeJiraDueDate } from '../domain/dates';
import type { IssueFact, IssueFetch } from '../domain/model';
import type { IssueReference } from '../domain/urls';
import type { StatusCategory } from '../shared/contracts';

/**
 * Jira REST access (verified against the Jira Cloud REST v3 OpenAPI spec):
 *   POST /rest/api/3/issue/bulkfetch                      read:jira-work
 *   GET  /rest/api/3/issue/{issueIdOrKey}                 read:jira-work
 *   GET  /rest/api/3/issue/createmeta/{project}/issuetypes read:jira-work
 *   POST /rest/api/3/issue                                write:jira-work
 *   GET  /rest/api/3/serverInfo                           no scope
 *
 * `user` calls run as the person using the app (`api.asUser()`), so Jira
 * enforces their Browse/Create permissions. `app` is only used by the issue
 * update trigger and for the site URL; app access never proves a person may
 * see something.
 */

export type Principal = 'user' | 'app';

const ISSUE_FIELDS = ['summary', 'status', 'duedate', 'project'] as const;
const BULK_LIMIT = 100;

const requester = (principal: Principal) => (principal === 'user' ? api.asUser() : api.asApp());

/** Errors that must reach the Forge platform (e.g. the user has not granted access yet). */
export function isPlatformAuthError(error: unknown): boolean {
  return error instanceof NeedsAuthenticationError;
}

export class JiraUnavailableError extends Error {
  constructor(message = 'Jira could not be reached.') {
    super(message);
    this.name = 'JiraUnavailableError';
  }
}

interface JiraIssueJson {
  id?: unknown;
  key?: unknown;
  fields?: {
    summary?: unknown;
    duedate?: unknown;
    status?: { name?: unknown; statusCategory?: { key?: unknown } };
    project?: { id?: unknown; key?: unknown };
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

function statusCategoryOf(value: unknown): StatusCategory {
  return value === 'new' || value === 'indeterminate' || value === 'done' ? value : 'unknown';
}

export function toIssueFact(issue: JiraIssueJson): IssueFact | null {
  const issueId = str(issue.id);
  if (!issueId) return null;
  const fields = issue.fields ?? {};
  return {
    issueId,
    readable: true,
    key: str(issue.key),
    summary: str(fields.summary),
    statusName: str(fields.status?.name),
    statusCategory: statusCategoryOf(fields.status?.statusCategory?.key),
    dueDate: normalizeJiraDueDate(fields.duedate),
    projectId: str(fields.project?.id),
    projectKey: str(fields.project?.key),
  };
}

export function unreadableIssueFact(issueId: string): IssueFact {
  return {
    issueId,
    readable: false,
    key: null,
    summary: null,
    statusName: null,
    statusCategory: null,
    dueDate: null,
    projectId: null,
    projectKey: null,
  };
}

/**
 * Read the current state of issues by id. Issues Jira does not return (not
 * found or not visible to the principal) become `readable: false`. Any
 * retriable error makes the whole read `unavailable`, because visibility is
 * then unknown and must not be guessed.
 */
export async function fetchIssueFacts(ids: readonly string[], principal: Principal): Promise<IssueFetch> {
  const unique = [...new Set(ids)];
  const facts = new Map<string, IssueFact>();
  if (unique.length === 0) return { ok: true, facts };

  try {
    for (let i = 0; i < unique.length; i += BULK_LIMIT) {
      const chunk = unique.slice(i, i + BULK_LIMIT);
      const response = await requester(principal).requestJira(route`/rest/api/3/issue/bulkfetch`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIdsOrKeys: chunk, fields: ISSUE_FIELDS }),
      });
      if (!response.ok) return { ok: false, reason: 'unavailable' };
      const body = (await response.json()) as { issues?: JiraIssueJson[]; issueErrors?: unknown[] };
      if (Array.isArray(body.issueErrors) && body.issueErrors.length > 0) {
        return { ok: false, reason: 'unavailable' };
      }
      for (const issue of body.issues ?? []) {
        const fact = toIssueFact(issue);
        if (fact && chunk.includes(fact.issueId)) facts.set(fact.issueId, fact);
      }
    }
  } catch (error) {
    if (isPlatformAuthError(error)) throw error;
    return { ok: false, reason: 'unavailable' };
  }

  for (const id of unique) {
    if (!facts.has(id)) facts.set(id, unreadableIssueFact(id));
  }
  return { ok: true, facts };
}

export type IssueLookup =
  | { kind: 'found'; fact: IssueFact }
  | { kind: 'not-accessible' }
  | { kind: 'unavailable' };

/** Find one issue by key or id as the current user. */
export async function lookupIssueAsUser(ref: IssueReference): Promise<IssueLookup> {
  try {
    const response = await api
      .asUser()
      .requestJira(route`/rest/api/3/issue/${ref.value}?fields=${ISSUE_FIELDS.join(',')}`, {
        headers: { Accept: 'application/json' },
      });
    if (response.status === 404 || response.status === 403) return { kind: 'not-accessible' };
    if (!response.ok) return { kind: 'unavailable' };
    const fact = toIssueFact((await response.json()) as JiraIssueJson);
    return fact ? { kind: 'found', fact } : { kind: 'unavailable' };
  } catch (error) {
    if (isPlatformAuthError(error)) throw error;
    return { kind: 'unavailable' };
  }
}

// Site base URL per installation, cached for the life of a warm container.
const siteUrlCache = new Map<string, string>();

/** Authoritative site URL (e.g. `https://example.atlassian.net`) from Jira itself. */
export async function getSiteBaseUrl(installationId: string): Promise<string> {
  const cached = siteUrlCache.get(installationId);
  if (cached) return cached;
  let response;
  try {
    response = await api.asApp().requestJira(route`/rest/api/3/serverInfo`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new JiraUnavailableError();
  }
  if (!response.ok) throw new JiraUnavailableError();
  const body = (await response.json()) as { baseUrl?: unknown };
  const baseUrl = str(body.baseUrl);
  if (!baseUrl || !baseUrl.startsWith('https://')) throw new JiraUnavailableError();
  const normalized = baseUrl.replace(/\/+$/, '');
  siteUrlCache.set(installationId, normalized);
  return normalized;
}

export type TaskTypeLookup =
  | { kind: 'found'; issueTypeId: string }
  | { kind: 'no-task' }
  | { kind: 'no-permission' }
  | { kind: 'unavailable' };

/** The standard "Task" issue type the current user can create in a project (F06). */
export async function findTaskIssueType(projectId: string): Promise<TaskTypeLookup> {
  try {
    const response = await api
      .asUser()
      .requestJira(route`/rest/api/3/issue/createmeta/${projectId}/issuetypes?maxResults=200`, {
        headers: { Accept: 'application/json' },
      });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return { kind: 'no-permission' };
    }
    if (!response.ok) return { kind: 'unavailable' };
    const body = (await response.json()) as {
      issueTypes?: Array<{ id?: unknown; name?: unknown; subtask?: unknown }>;
    };
    const types = body.issueTypes ?? [];
    if (types.length === 0) return { kind: 'no-permission' };
    const task = types.find((t) => t.name === 'Task' && t.subtask !== true);
    const id = task ? str(task.id) : null;
    return id ? { kind: 'found', issueTypeId: id } : { kind: 'no-task' };
  } catch (error) {
    if (isPlatformAuthError(error)) throw error;
    return { kind: 'unavailable' };
  }
}

/**
 * - `created`: Jira confirmed the new issue.
 * - `rejected`: Jira answered with a 4xx error, so nothing was created.
 * - `unknown`: no usable answer (network error, timeout, 5xx, malformed 2xx).
 *   Jira may have created the issue, so callers must not report "not created".
 */
export type CreateIssueOutcome =
  | { kind: 'created'; id: string; key: string }
  | { kind: 'rejected'; status: number; message: string }
  | { kind: 'unknown' };

/** Create one Jira issue as the current user. Only called after explicit UI confirmation. */
export async function createIssueAsUser(input: {
  projectId: string;
  issueTypeId: string;
  summary: string;
  description: unknown;
}): Promise<CreateIssueOutcome> {
  let response;
  try {
    response = await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          project: { id: input.projectId },
          issuetype: { id: input.issueTypeId },
          summary: input.summary,
          description: input.description,
        },
      }),
    });
  } catch (error) {
    // NeedsAuthenticationError is raised before any request is sent; callers rethrow it.
    if (isPlatformAuthError(error)) throw error;
    return { kind: 'unknown' };
  }

  if (response.ok) {
    try {
      const body = (await response.json()) as { id?: unknown; key?: unknown };
      const id = str(body.id);
      const key = str(body.key);
      if (id && key) return { kind: 'created', id, key };
    } catch {
      // fall through: Jira said OK but the body is unusable
    }
    return { kind: 'unknown' };
  }
  if (response.status >= 400 && response.status < 500) {
    return { kind: 'rejected', status: response.status, message: await jiraErrorMessage(response) };
  }
  return { kind: 'unknown' };
}

async function jiraErrorMessage(response: { status: number; text(): Promise<string> }): Promise<string> {
  const fallback =
    response.status === 403 || response.status === 401
      ? "You don't have permission to create issues in this project."
      : `Jira rejected the request (HTTP ${response.status}).`;
  try {
    const body = JSON.parse(await response.text()) as { errorMessages?: unknown; errors?: unknown };
    const messages = [
      ...(Array.isArray(body.errorMessages) ? body.errorMessages : []),
      ...(body.errors && typeof body.errors === 'object' ? Object.values(body.errors) : []),
    ].filter((m): m is string => typeof m === 'string');
    return messages.length > 0 ? messages.join(' ').slice(0, 300) : fallback;
  } catch {
    return fallback;
  }
}
