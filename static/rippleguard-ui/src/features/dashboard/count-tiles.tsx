import { RISK_LABELS, type RiskStatus } from '@shared/contracts'
import { RISK_ORDER, RISK_STYLES } from '@/lib/status-styles'
import { cn } from '@/lib/utils'

interface CountTilesProps {
  counts: Record<RiskStatus, number>
  selected: RiskStatus | null
  onSelect: (status: RiskStatus | null) => void
}

/** The four F01 counts. Each tile is also a single-select status filter. */
export function CountTiles({ counts, selected, onSelect }: CountTilesProps) {
  return (
    <div role="group" aria-label="Filter commitments by risk status" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {RISK_ORDER.map((status) => {
        const style = RISK_STYLES[status]
        const Icon = style.icon
        const pressed = selected === status
        return (
          <button
            key={status}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(pressed ? null : status)}
            className={cn(
              'group flex flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors outline-none',
              'hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50',
              pressed && 'border-foreground/40 bg-muted ring-1 ring-foreground/20',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', style.text)}>
                <Icon aria-hidden="true" className="size-4" />
                {RISK_LABELS[status]}
              </span>
              <span aria-hidden="true" className={cn('size-2 rounded-full', style.accent)} />
            </span>
            <span className="font-heading text-3xl font-semibold tabular-nums">{counts[status]}</span>
            <span className="sr-only">{pressed ? '(filter applied)' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}
