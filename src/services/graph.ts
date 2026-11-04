import api from '@forge/api';
import type { Commitment } from '../domain/model';
import { confluencePageId, parseSameSiteUrl } from '../domain/urls';
import { EVIDENCE_LABELS, type GraphContext, type GraphContextNode } from '../shared/contracts';

/**
 * F05 optional Teamwork Graph enrichment (read-only, permission-gated, Preview).
 *
 * New apps can't send raw Cypher, and no curated query starts from a Jira work
 * item and returns linked work items or Confluence pages. The one supported
 * fit is the curated field `confluencePageLinkedConfluencePages`, which starts
 * from the commitment's Confluence source page. Scope: read:graph:page:confluence.
 * Calls run as the user, so Teamwork Graph applies their permissions; results
 * are also filtered to same-site URLs. Suggested nodes are display-only: they
 * never become commitment links and never feed the risk engine. Any failure,
 * missing scope (returns empty), or empty result shows the fallback message.
 */

const MAX_NODES = 10;

const QUERY = `query rippleguard_sourcePageLinks($id: ID!) {
  confluencePageLinkedConfluencePages(id: $id, first: ${MAX_NODES}) {
    edges {
      node {
        __typename
        ... on ConfluencePage { id pageId title webUrl }
      }
    }
  }
}`;

const unavailable = (): GraphContext => ({
  status: 'unavailable',
  nodes: [],
  message: EVIDENCE_LABELS.graphUnavailable,
});

interface GraphResponse {
  data?: {
    confluencePageLinkedConfluencePages?: {
      edges?: Array<{ node?: { __typename?: unknown; id?: unknown; pageId?: unknown; title?: unknown; webUrl?: unknown } }>;
    };
  };
  errors?: unknown[];
}

export async function graphContextFor(
  commitment: Commitment,
  siteBaseUrl: string,
  cloudId: string | null,
): Promise<GraphContext> {
  const pageId = confluencePageId(commitment.sourceUrl, siteBaseUrl);
  if (!pageId || !cloudId) return unavailable();

  try {
    const response = await api
      .asUser()
      .requestTeamworkGraph(QUERY, { id: `ari:cloud:confluence:${cloudId}:page/${pageId}` });
    if (!response.ok) return unavailable();
    const body = (await response.json()) as GraphResponse;
    if (Array.isArray(body.errors) && body.errors.length > 0) return unavailable();

    const nodes: GraphContextNode[] = [];
    const seen = new Set<string>([pageId]);
    for (const edge of body.data?.confluencePageLinkedConfluencePages?.edges ?? []) {
      const node = edge.node;
      if (!node || node.__typename !== 'ConfluencePage') continue;
      const id = typeof node.pageId === 'string' ? node.pageId : typeof node.id === 'string' ? node.id : null;
      const title = typeof node.title === 'string' ? node.title.trim().slice(0, 200) : '';
      const url = typeof node.webUrl === 'string' ? parseSameSiteUrl(node.webUrl, siteBaseUrl) : null;
      if (!id || !title || !url || seen.has(id)) continue;
      seen.add(id);
      nodes.push({ id: `graph-page-${id}`, type: 'confluence_page', title, url: url.toString() });
    }
    return nodes.length > 0 ? { status: 'available', nodes, message: null } : unavailable();
  } catch {
    // Optional enrichment must never break the Impact Explorer (F05-T03).
    return unavailable();
  }
}
