import { lazy, Suspense } from 'react'
import { ShieldCheckIcon } from 'lucide-react'
import { LoadingState } from '@/components/states'
import { CommitmentsPage } from '@/features/commitments/commitments-page'
import { EditCommitmentPage, NewCommitmentPage } from '@/features/commitments/commitment-form-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { CommitmentDetailPage } from '@/features/detail/commitment-detail-page'
import { useRouter } from '@/lib/router-context'
import { paths, type Route } from '@/lib/routes'
import { cn } from '@/lib/utils'

// React Flow is only downloaded when the Impact Explorer opens.
const ImpactExplorerPage = lazy(() =>
  import('@/features/explorer/impact-explorer-page').then((m) => ({ default: m.ImpactExplorerPage })),
)

/** Top-level views reachable from the navigation. Impact Explorer opens from a commitment. */
const NAV: Array<{ label: string; to: string; matches: (route: Route) => boolean }> = [
  { label: 'Impact Dashboard', to: paths.dashboard(), matches: (r) => r.name === 'dashboard' },
  {
    label: 'Commitments',
    to: paths.commitments(),
    matches: (r) => r.name !== 'dashboard',
  },
]

export function GlobalApp() {
  const { route, navigate } = useRouter()

  return (
    <div className="bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <span className="inline-flex items-center gap-2 font-heading text-base font-semibold">
            <ShieldCheckIcon aria-hidden="true" className="size-5 text-primary" />
            RippleGuard
          </span>
          <nav aria-label="RippleGuard">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => {
                const current = item.matches(route)
                return (
                  <li key={item.to}>
                    <a
                      href={item.to}
                      aria-current={current ? 'page' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        navigate(item.to)
                      }}
                      className={cn(
                        'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors outline-none',
                        'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                        current ? 'bg-muted text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-6 py-6">
        <RouteView route={route} />
      </main>
    </div>
  )
}

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />
    case 'commitments':
      return <CommitmentsPage />
    case 'new':
      return <NewCommitmentPage />
    case 'edit':
      return <EditCommitmentPage key={route.id} id={route.id} />
    case 'detail':
      return <CommitmentDetailPage key={route.id} id={route.id} />
    case 'impact':
      return (
        <Suspense fallback={<LoadingState label="Loading Impact Explorer" rows={4} />}>
          <ImpactExplorerPage key={route.id} id={route.id} />
        </Suspense>
      )
  }
}
