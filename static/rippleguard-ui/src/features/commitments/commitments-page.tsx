import { useMemo, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { LIFECYCLE_LABELS, type Lifecycle } from '@shared/contracts'
import { CommitmentsTable } from '@/components/commitments-table'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, LiveMessage, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useResolver } from '@/hooks/use-resolver'
import { backend } from '@/lib/backend'
import { useRouter } from '@/lib/router-context'
import { paths } from '@/lib/routes'
import { byPromisedDate } from '@/lib/sort'

type LifecycleFilter = Lifecycle | 'all'

const FILTERS: Array<{ value: LifecycleFilter; label: string }> = [
  { value: 'active', label: LIFECYCLE_LABELS.active },
  { value: 'fulfilled', label: LIFECYCLE_LABELS.fulfilled },
  { value: 'archived', label: LIFECYCLE_LABELS.archived },
  { value: 'all', label: 'All' },
]

export function CommitmentsPage() {
  const { navigate } = useRouter()
  const [filter, setFilter] = useState<LifecycleFilter>('active')
  const { state, refetch } = useResolver(() => backend('listCommitments', { scope: 'all' }), 'commitments-all')

  const rows = useMemo(() => {
    if (state.status !== 'success') return []
    return state.data.commitments
      .filter((c) => filter === 'all' || c.lifecycle === filter)
      .sort(byPromisedDate)
  }, [state, filter])

  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? 'All'

  const newButton = (
    <Button onClick={() => navigate(paths.newCommitment())}>
      <PlusIcon aria-hidden="true" />
      New commitment
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Commitments"
        description="Customer and partner promises, the evidence behind them, and the Jira work that delivers them."
        actions={newButton}
      />

      <div className="flex items-center gap-3">
        <Label htmlFor="lifecycle-filter" className="text-sm text-muted-foreground">
          Lifecycle
        </Label>
        <Select value={filter} onValueChange={(value) => setFilter(value as LifecycleFilter)}>
          <SelectTrigger id="lifecycle-filter" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.status === 'loading' ? <LoadingState label="Loading commitments" /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={refetch} /> : null}

      {state.status === 'success' ? (
        <>
          <LiveMessage message={`Showing ${rows.length} ${filterLabel.toLowerCase()} commitments`} />
          {state.data.commitments.length === 0 ? (
            <EmptyState
              title="No commitments yet"
              description="Create the first one: a title, the customer, the promised date, a source link with a short excerpt, and the Jira issues that deliver it."
              action={newButton}
            />
          ) : rows.length === 0 ? (
            <EmptyState title={`No ${filterLabel.toLowerCase()} commitments`} />
          ) : (
            <CommitmentsTable
              commitments={rows}
              caption={`${filterLabel} commitments, sorted by promised date`}
              showLifecycle
            />
          )}
        </>
      ) : null}
    </div>
  )
}
