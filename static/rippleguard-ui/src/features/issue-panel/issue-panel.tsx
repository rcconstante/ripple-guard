import { useState } from 'react'
import { router } from '@forge/bridge'
import { ArrowUpRightIcon } from 'lucide-react'
import { DateText } from '@/components/date-text'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { LifecycleBadge, RiskBadge } from '@/components/status-badges'
import { Button } from '@/components/ui/button'
import { useResolver } from '@/hooks/use-resolver'
import { useAppContext, type AppContextValue } from '@/lib/app-context'
import { backend } from '@/lib/backend'
import { paths } from '@/lib/routes'

const GLOBAL_PAGE_MODULE_KEY = 'rippleguard-global-page'

/** Builds the global page URL from the Forge local id: ari:cloud:ecosystem::extension/<appId>/<envId>/static/<moduleKey>. */
function globalPageUrl(context: AppContextValue, path: string): string | null {
  const match = /^ari:cloud:ecosystem::extension\/([^/]+)\/([^/]+)\//.exec(context.localId)
  const appId = match?.[1]
  const envId = context.environmentId ?? match?.[2]
  if (!appId || !envId || !context.siteUrl) return null
  return `${context.siteUrl.replace(/\/$/, '')}/jira/apps/${appId}/${envId}${path}`
}

/** F03 issue panel: read-only list of commitments explicitly linked to the open issue. */
export function IssuePanel() {
  const context = useAppContext()
  const { state, refetch } = useResolver(() => backend('getIssueCommitments'), 'issue-panel')
  const [navError, setNavError] = useState<string | null>(null)

  const openDetail = async (id: string) => {
    setNavError(null)
    const path = paths.detail(id)
    try {
      await router.navigate({ target: 'module', moduleKey: GLOBAL_PAGE_MODULE_KEY, path })
    } catch {
      const url = globalPageUrl(context, path)
      if (!url) {
        setNavError("Couldn't open RippleGuard. Open it from the Apps menu instead.")
        return
      }
      try {
        await router.navigate(url)
      } catch {
        setNavError("Couldn't open RippleGuard. Open it from the Apps menu instead.")
      }
    }
  }

  if (state.status === 'loading') return <LoadingState label="Loading linked commitments" rows={2} className="p-1" />
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={refetch} className="py-6" />

  const { commitments } = state.data
  if (commitments.length === 0) {
    return <EmptyState title="No commitments are linked to this issue." className="py-6" />
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <ul className="flex flex-col gap-2" aria-label="Commitments linked to this issue">
        {commitments.map((commitment) => (
          <li key={commitment.id} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
            <p className="text-sm font-medium break-words">{commitment.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Promised <DateText value={commitment.promisedDate} />
              </span>
              {commitment.risk ? (
                <RiskBadge status={commitment.risk.status} stale={commitment.risk.stale} />
              ) : (
                <LifecycleBadge lifecycle={commitment.lifecycle} />
              )}
            </div>
            <div>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0"
                onClick={() => void openDetail(commitment.id)}
                aria-label={`View details of ${commitment.title}`}
              >
                View details
                <ArrowUpRightIcon aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {navError ? (
        <p role="alert" className="text-xs text-destructive">
          {navError}
        </p>
      ) : null}
    </div>
  )
}
