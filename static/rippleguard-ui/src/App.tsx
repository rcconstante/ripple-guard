import { lazy, Suspense, useEffect, useState } from 'react'
import { view } from '@forge/bridge'
import { ErrorState } from '@/components/states'
import { Skeleton } from '@/components/ui/skeleton'
import { AppContext, type AppContextValue } from '@/lib/app-context'
import { RouterProvider } from '@/lib/router'

// Each module loads only its own code: the issue panel never downloads the global page views.
const IssuePanel = lazy(() => import('@/features/issue-panel/issue-panel').then((m) => ({ default: m.IssuePanel })))
const GlobalApp = lazy(() => import('@/global-app').then((m) => ({ default: m.GlobalApp })))

type ContextState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; value: AppContextValue }

/**
 * One Custom UI resource serves both manifest modules: the jira:issuePanel
 * renders the linked-commitments panel; everything else is the global page.
 */
export default function App() {
  const [state, setState] = useState<ContextState>({ status: 'loading' })

  useEffect(() => {
    const active = { current: true }
    view
      .getContext()
      .then((context) => {
        if (!active.current) return
        setState({
          status: 'ready',
          value: {
            siteUrl: context.siteUrl ?? '',
            localId: context.localId ?? '',
            environmentId: context.environmentId ?? null,
            moduleKey: context.moduleKey ?? '',
            extensionType: typeof context.extension?.type === 'string' ? context.extension.type : '',
          },
        })
      })
      .catch(() => {
        if (active.current) setState({ status: 'error' })
      })
    return () => {
      active.current = false
    }
  }, [])

  if (state.status === 'loading') return <AppSkeleton />

  if (state.status === 'error') {
    return (
      <div className="p-4">
        <ErrorState
          error={{
            code: 'CONTEXT_UNAVAILABLE',
            message: 'RippleGuard runs inside Jira. Open it from the Jira Apps menu or an issue.',
          }}
        />
      </div>
    )
  }

  return (
    <AppContext.Provider value={state.value}>
      <Suspense fallback={<AppSkeleton />}>
        {state.value.extensionType === 'jira:issuePanel' ? (
          <IssuePanel />
        ) : (
          <RouterProvider>
            <GlobalApp />
          </RouterProvider>
        )}
      </Suspense>
    </AppContext.Provider>
  )
}

function AppSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 p-4">
      <span className="sr-only">Loading RippleGuard…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
