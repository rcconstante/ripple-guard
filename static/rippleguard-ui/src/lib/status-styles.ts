import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  HelpCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import type { RiskStatus } from '@shared/contracts'

/** Display order of the four risk states (FEATURE_SCOPE F01). */
export const RISK_ORDER: RiskStatus[] = ['on_track', 'at_risk', 'overdue', 'needs_review']

/** Icon and colour classes per risk state. Colour is never the only signal: labels are always shown. */
export const RISK_STYLES: Record<RiskStatus, { icon: LucideIcon; badge: string; accent: string; text: string }> = {
  on_track: {
    icon: CheckCircle2Icon,
    badge: 'bg-status-on-track-bg text-status-on-track border-status-on-track/30',
    accent: 'bg-status-on-track',
    text: 'text-status-on-track',
  },
  at_risk: {
    icon: AlertTriangleIcon,
    badge: 'bg-status-at-risk-bg text-status-at-risk border-status-at-risk/30',
    accent: 'bg-status-at-risk',
    text: 'text-status-at-risk',
  },
  overdue: {
    icon: AlertOctagonIcon,
    badge: 'bg-status-overdue-bg text-status-overdue border-status-overdue/30',
    accent: 'bg-status-overdue',
    text: 'text-status-overdue',
  },
  needs_review: {
    icon: HelpCircleIcon,
    badge: 'bg-status-needs-review-bg text-status-needs-review border-status-needs-review/30',
    accent: 'bg-status-needs-review',
    text: 'text-status-needs-review',
  },
}
