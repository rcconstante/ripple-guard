export type Route =
  | { name: 'dashboard' }
  | { name: 'commitments' }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'detail'; id: string }
  | { name: 'impact'; id: string }

const ID = '([A-Za-z0-9-]{1,64})'

const PATTERNS: Array<[RegExp, (id: string) => Route]> = [
  [/^\/commitments$/, () => ({ name: 'commitments' })],
  [/^\/commitments\/new$/, () => ({ name: 'new' })],
  [new RegExp(`^/commitments/${ID}/edit$`), (id) => ({ name: 'edit', id })],
  [new RegExp(`^/commitments/${ID}/impact$`), (id) => ({ name: 'impact', id })],
  [new RegExp(`^/commitments/${ID}$`), (id) => ({ name: 'detail', id })],
]

/** Maps a path (relative to the app URL) to a route. Unknown paths go to the dashboard. */
export function parseRoute(pathname: string | undefined | null): Route {
  const path = normalizePath(pathname)
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(path)
    if (match) return build(match[1] ?? '')
  }
  return { name: 'dashboard' }
}

export function normalizePath(pathname: string | undefined | null): string {
  if (!pathname) return '/'
  let path = pathname.split(/[?#]/)[0] ?? '/'
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

export const paths = {
  dashboard: () => '/',
  commitments: () => '/commitments',
  newCommitment: () => '/commitments/new',
  detail: (id: string) => `/commitments/${encodeURIComponent(id)}`,
  edit: (id: string) => `/commitments/${encodeURIComponent(id)}/edit`,
  impact: (id: string) => `/commitments/${encodeURIComponent(id)}/impact`,
}
