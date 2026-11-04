/**
 * Same-site URL handling. RippleGuard never fetches these URLs; it only checks
 * that they point at the current Atlassian Cloud site and extracts identifiers.
 */

const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9_]*-[1-9]\d*$/;
const ISSUE_ID = /^[1-9]\d{0,17}$/;
const MAX_URL_LENGTH = 2000;

/** Lower-cased hostname of a site base URL such as `https://example.atlassian.net`. */
export function siteHost(siteBaseUrl: string): string {
  return new URL(siteBaseUrl).hostname.toLowerCase();
}

/** Parse an https URL on the given site; null when invalid or cross-site. */
export function parseSameSiteUrl(value: string, siteBaseUrl: string): URL | null {
  if (value.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port !== '') return null;
  if (url.hostname.toLowerCase() !== siteHost(siteBaseUrl)) return null;
  return url;
}

export function isIssueId(value: unknown): value is string {
  return typeof value === 'string' && ISSUE_ID.test(value);
}

export type IssueReference = { kind: 'key' | 'id'; value: string };

export type IssueReferenceParse =
  | { ok: true; ref: IssueReference }
  | { ok: false; message: string };

/**
 * Accepts an issue key (`PROJ-12`), a numeric issue id, or a same-site Jira URL
 * (`/browse/PROJ-12` or `?selectedIssue=PROJ-12`).
 */
export function parseIssueReference(raw: string, siteBaseUrl: string): IssueReferenceParse {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, message: 'Enter a Jira issue key or URL.' };
  if (value.length > MAX_URL_LENGTH) return { ok: false, message: 'That value is too long.' };

  if (/^https?:\/\//i.test(value)) {
    const url = parseSameSiteUrl(value, siteBaseUrl);
    if (!url) return { ok: false, message: 'Use an https link to an issue on this Jira site.' };
    const browse = /\/browse\/([^/?#]+)/.exec(url.pathname)?.[1];
    const candidate = browse ?? url.searchParams.get('selectedIssue') ?? '';
    if (ISSUE_KEY.test(candidate)) return { ok: true, ref: { kind: 'key', value: candidate.toUpperCase() } };
    return { ok: false, message: 'That link does not point to a Jira issue.' };
  }

  if (ISSUE_KEY.test(value)) return { ok: true, ref: { kind: 'key', value: value.toUpperCase() } };
  if (ISSUE_ID.test(value)) return { ok: true, ref: { kind: 'id', value } };
  return { ok: false, message: 'Enter a Jira issue key (for example PROJ-12) or an issue URL.' };
}

/**
 * Confluence page id from a same-site page URL
 * (`/wiki/spaces/KEY/pages/123/Title` or `...viewpage.action?pageId=123`).
 */
export function confluencePageId(sourceUrl: string, siteBaseUrl: string): string | null {
  const url = parseSameSiteUrl(sourceUrl, siteBaseUrl);
  if (!url || !url.pathname.startsWith('/wiki/')) return null;
  const fromPath = /\/pages\/(\d{1,18})(?:\/|$)/.exec(url.pathname)?.[1];
  const fromQuery = url.searchParams.get('pageId');
  const id = fromPath ?? fromQuery;
  return id && /^\d{1,18}$/.test(id) ? id : null;
}

export function issueBrowseUrl(siteBaseUrl: string, issueKey: string): string {
  return `${siteBaseUrl.replace(/\/+$/, '')}/browse/${encodeURIComponent(issueKey)}`;
}
