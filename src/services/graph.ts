import api from '@forge/api';
import type { Commitment, IssueFact } from '../domain/model';
import { issueBrowseUrl } from '../domain/urls';
import { EVIDENCE_LABELS, type GraphContext, type GraphContextNode } from '../shared/contracts';
import { fetchIssueFacts } from './jira';

/**
 * F05 optional Teamwork Graph enrichment (read-only, permission-gated, Preview).
 *
 * Starts from each Jira issue the user linked to the commitment and asks
 * Teamwork Graph for related work items with the curated field
 * `jiraWorkItemHierarchy` (parent, child and issue-link relationships).
 * Scope: read:graph:issue:jira. Apps can't send raw Cypher.
 *
 * - Calls run as the user, so Teamwork Graph applies their permissions.
 * - Every suggested issue is then re-read from Jira as the user; anything the
 *   user can't read right now is dropped, and the node shows Jira's current
 *   key/summary/status/due date (not the graph index copy).
 * - The relationship kind is not shown: the graph only *suggests* that the
 *   issues are related. Suggested nodes are display-only: they never become
 *   commitment links and never feed the risk engine.
 * - Any failure, missing scope (returns empty), or empty result shows the
 *   fallback message `Additional Teamwork Graph context unavailable`.
 */

export const MAX_GRAPH_NODES = 10;
const PER_ISSUE = 5;

const QUERY = `query rippleguard_relatedWorkItems($id: ID!) {
  jiraWorkItemHierarchy(id: $id, first: ${PER_ISSUE}) {
    edges {
      node {
        __typename
        ... on JiraWorkItem { id issueId }
      }
    }
  }
}`;

const unavailable = (): GraphContext => ({
  status: 'unavailable',
  nodes: [],
  message: EVIDENCE_LABELS.graphUnavailable,
});

interface HierarchyResponse {
  data?: {
    jiraWorkItemHierarchy?: {
      edges?: Array<{ node?: { __typename?: unknown; id?: unknown; issueId?: unknown } }>;
    } | null;
  };
  errors?: unknown[];
}

const NUMERIC_ID = /^\d{1,18}$/;

/** Issue id from the node: `issueId`, or the tail of a Jira issue ARI on this site. */
export function relatedIssueId(node: { id?: unknown; issueId?: unknown }, cloudId: string): string | null {
  if (typeof node.issueId === 'string' && NUMERIC_ID.test(node.issueId)) return node.issueId;
  if (typeof node.id !== 'string') return null;
  const prefix = `ari:cloud:jira:${cloudId}:issue/`;
  if (!node.id.startsWith(prefix)) return null; // other sites are never shown
  const id = node.id.slice(prefix.length);
  return NUMERIC_ID.test(id) ? id : null;
}

/**
 * Teamwork Graph (Preview) intermittently rejects valid reads on some sites with
 * "User is not permitted to query this organization" (reported on the Atlassian
 * developer community, Nov 2026). Only that error is retried, a few times.
 */
const TRANSIENT_DENIAL = /not permitted to query this organization/i;
const ATTEMPTS = 5;

function isTransientDenial(errors: unknown[]): boolean {
  return errors.some((e) => TRANSIENT_DENIAL.test(String((e as { message?: unknown }).message ?? '')));
}

async function relatedIdsFor(issueId: string, cloudId: string): Promise<string[] | null> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await relatedIdsOnce(issueId, cloudId);
    if (result !== 'retry') return result;
    if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }
  console.warn('RippleGuard graph query denied after retries', ATTEMPTS);
  return null;
}

async function relatedIdsOnce(issueId: string, cloudId: string): Promise<string[] | null | 'retry'> {
  try {
    const response = await api
      .asUser()
      .requestTeamworkGraph(QUERY, { id: `ari:cloud:jira:${cloudId}:issue/${issueId}` });
    if (!response.ok) {
      console.warn('RippleGuard graph query failed', response.status);
      return null;
    }
    const body = (await response.json()) as HierarchyResponse;
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      if (isTransientDenial(body.errors)) return 'retry';
      // Platform error classifications only (no user data), for diagnosing denied access.
      const kinds = body.errors.slice(0, 3).map((e) => {
        const err = e as { message?: unknown; extensions?: { classification?: unknown; statusCode?: unknown } };
        const message = typeof err.message === 'string' ? err.message.replace(/ari:[^\s"]+/g, '<ari>').slice(0, 140) : '';
        return `${String(err.extensions?.classification ?? 'unknown')}/${String(err.extensions?.statusCode ?? '')}: ${message}`;
      });
      console.warn('RippleGuard graph query returned errors', body.errors.length, kinds.join(' | '));
      return null;
    }
    const ids: string[] = [];
    for (const edge of body.data?.jiraWorkItemHierarchy?.edges ?? []) {
      const node = edge.node;
      if (!node || node.__typename !== 'JiraWorkItem') continue;
      const id = relatedIssueId(node, cloudId);
      if (id) ids.push(id);
    }
    return ids;
  } catch (error) {
    // Optional enrichment must never break the Impact Explorer (F05-T03).
    console.warn('RippleGuard graph query threw', error instanceof Error ? error.name : typeof error);
    return null;
  }
}

/**
 * @param linkedFacts the commitment's linked issues, already verified readable
 *   by the caller (strict access), keyed by issue id.
 */
export async function graphContextFor(
  commitment: Commitment,
  linkedFacts: ReadonlyMap<string, IssueFact>,
  siteBaseUrl: string,
  cloudId: string | null,
): Promise<GraphContext> {
  if (!cloudId) return unavailable();
  const linked = new Set(commitment.linkedIssueIds);
  const sources = commitment.linkedIssueIds.filter((id) => linkedFacts.get(id)?.readable);
  if (sources.length === 0) return unavailable();

  const results = await Promise.all(sources.map((id) => relatedIdsFor(id, cloudId)));
  if (results.every((r) => r === null)) return unavailable();

  // First source wins; never repeat an issue the user already linked.
  const relatedTo = new Map<string, string>();
  results.forEach((ids, index) => {
    const source = sources[index];
    if (!ids || !source) return;
    for (const id of ids) {
      if (relatedTo.size >= MAX_GRAPH_NODES) break;
      if (!linked.has(id) && !relatedTo.has(id)) relatedTo.set(id, source);
    }
  });
  if (relatedTo.size === 0) return unavailable();

  // Re-check every suggestion with Jira as the user (and use Jira's current data).
  const fetch = await fetchIssueFacts([...relatedTo.keys()], 'user');
  if (!fetch.ok) return unavailable();

  const nodes: GraphContextNode[] = [];
  for (const [id, source] of relatedTo) {
    const fact = fetch.facts.get(id);
    const sourceFact = linkedFacts.get(source);
    if (!fact?.readable || !fact.key || !sourceFact?.key) continue;
    nodes.push({
      id: `graph-issue-${id}`,
      type: 'jira_issue',
      issueId: id,
      issueKey: fact.key,
      title: (fact.summary ?? fact.key).slice(0, 200),
      url: issueBrowseUrl(siteBaseUrl, fact.key),
      statusName: fact.statusName,
      dueDate: fact.dueDate,
      projectKey: fact.projectKey,
      relatedToIssueId: source,
      relatedToKey: sourceFact.key,
    });
  }
  return nodes.length > 0 ? { status: 'available', nodes, message: null } : unavailable();
}
