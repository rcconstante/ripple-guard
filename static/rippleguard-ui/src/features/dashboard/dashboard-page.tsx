import { useMemo, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { RISK_LABELS, type RiskStatus } from '@shared/contracts'
import { CommitmentsTable } from '@/components/commitments-table'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, LiveMessage, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CountTiles } from '@/features/dashboard/count-tiles'
import { useResolver } from '@/hooks/use-resolver'
import { backend } from '@/lib/backend'
import { RISK_ORDER } from '@/lib/status-styles'
import { byPromisedDate } from '@/lib/sort'
import { useRouter } from '@/lib/router-context'
import { paths } from '@/lib/routes'

export function DashboardPage() {
  const { navigate } = useRouter()
  const [filter, setFilter] = useState<RiskStatus | null>(null)
  const { state, refetch } = useResolver(() => backend('listCommitments', { scope: 'active' }), 'dashboard')

  const active = useMemo(
    () => (state.status === 'success' ? state.data.commitments.filter((c) => c.lifecycle === 'active') : []),
    [state],
  )

  const counts = useMemo(() => {
    const result = Object.fromEntries(RISK_ORDER.map((s) => [s, 0])) as Record<RiskStatus, number>
    for (const commitment of active) {
      if (commitment.risk) result[commitment.risk.status] += 1
    }
    return result
  }, [active])

  const rows = useMemo(
    () => active.filter((c) => !filter || c.risk?.status === filter).sort(byPromisedDate),
    [active, filter],
  )

  const newButton = (
    <Button onClick={() => navigate(paths.newCommitment())}>
      <PlusIcon aria-hidden="true" />
      New commitment
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Impact Dashboard"
        description="Active customer commitments and their current risk, calculated from the linked Jira work."
        actions={newButton}
      />

      {state.status === 'loading' ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
            {RISK_ORDER.map((s) => (
              <Skeleton key={s} className="h-24" />
            ))}
          </div>
          <LoadingState label="Loading commitments" />
        </>
      ) : null}

      {state.status === 'error' ? <ErrorState error={state.error} onRetry={refetch} /> : null}

      {state.status === 'success' ? (
        <>
          <CountTiles counts={counts} selected={filter} onSelect={setFilter} />
          <LiveMessage
            message={
              filter
                ? `Showing ${rows.length} ${RISK_LABELS[filter]} commitments`
                : `Showing ${rows.length} active commitments`
            }
          />

          {active.length === 0 ? (
            <EmptyState
              title="No active commitments yet"
              description="Record a customer promise and link the Jira work that delivers it. RippleGuard will flag it when that work slips past the promised date."
              action={newButton}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={`No ${filter ? RISK_LABELS[filter] : ''} commitments`}
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter(null)}>
                  Clear filter
                </Button>
              }
            />
          ) : (
            <CommitmentsTable
              commitments={rows}
              caption={filter ? `${RISK_LABELS[filter]} commitments, sorted by promised date` : 'Active commitments, sorted by promised date'}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
