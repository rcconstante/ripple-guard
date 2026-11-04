import {
  ArchiveIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  ClockAlertIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  EVIDENCE_LABELS,
  LIFECYCLE_LABELS,
  RISK_LABELS,
  type Lifecycle,
  type RiskStatus,
} from '@shared/contracts'
import { RISK_STYLES } from '@/lib/status-styles'
import { cn } from '@/lib/utils'


interface RiskBadgeProps {
  status: RiskStatus
  stale?: boolean
  size?: 'sm' | 'lg'
  className?: string
}

/** Risk status with its exact label always visible (colour is never the only signal). */
export function RiskBadge({ status, stale = false, size = 'sm', className }: RiskBadgeProps) {
  const style = RISK_STYLES[status]
  const Icon = style.icon
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
          size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
          style.badge,
          stale && 'border-dashed',
        )}
      >
        <Icon aria-hidden="true" className={size === 'lg' ? 'size-4' : 'size-3.5'} />
        {RISK_LABELS[status]}
      </span>
      {stale ? <StaleLabel size={size} /> : null}
    </span>
  )
}

export function StaleLabel({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/50 font-medium text-muted-foreground',
        size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
      )}
    >
      <ClockAlertIcon aria-hidden="true" className={size === 'lg' ? 'size-4' : 'size-3.5'} />
      {EVIDENCE_LABELS.stale}
    </span>
  )
}

const LIFECYCLE_ICONS: Record<Lifecycle, LucideIcon> = {
  active: CircleDotIcon,
  fulfilled: CheckCircle2Icon,
  archived: ArchiveIcon,
}

export function LifecycleBadge({ lifecycle, className }: { lifecycle: Lifecycle; className?: string }) {
  const Icon = LIFECYCLE_ICONS[lifecycle]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        lifecycle === 'active'
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-status-neutral/30 bg-status-neutral-bg text-status-neutral',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {LIFECYCLE_LABELS[lifecycle]}
    </span>
  )
}
