import { SparklesIcon, ListChecksIcon } from 'lucide-react'
import {
  REASON_LABELS,
  type ReasonEvidence,
  type RiskExplanation,
  type RiskView,
} from '@shared/contracts'
import { DateText, TimestampDate } from '@/components/date-text'
import { Section } from '@/components/page-header'
import { RiskBadge, StaleLabel } from '@/components/status-badges'
import { UnreadableIssue } from '@/components/issue-key-list'
import { ExternalLink } from '@/components/external-link'
import { cn } from '@/lib/utils'

interface RiskSectionProps {
  risk: RiskView
  promisedDate: string
  explanation: RiskExplanation | null
  /** Issue id → browser URL, for evidence links. */
  issueUrls: ReadonlyMap<string, string | null>
}

/** F04: the deterministic status, an optional grounded explanation, and ALWAYS the raw facts. */
export function RiskSection({ risk, promisedDate, explanation, issueUrls }: RiskSectionProps) {
  return (
    <Section
      headingId="risk-heading"
      title="Current risk"
      description="Calculated by RippleGuard's rules from the promised date and the linked Jira issues."
      className={cn(risk.stale && 'border-dashed border-muted-foreground/50')}
    >
      <div className="flex flex-wrap items-center gap-3">
        <RiskBadge status={risk.status} size="lg" />
        {risk.stale ? <StaleLabel size="lg" /> : null}
      </div>
      {risk.stale ? (
        <p className="text-sm text-muted-foreground">
          RippleGuard couldn't read the current Jira data, so this is the last status it stored on{' '}
          <TimestampDate value={risk.evaluatedAt} />. It may be out of date.
        </p>
      ) : null}

      {explanation ? (
        <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
          <p className="text-sm leading-relaxed whitespace-pre-line">{explanation.text}</p>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {explanation.source === 'ai' ? (
              <>
                <SparklesIcon aria-hidden="true" className="size-3.5" />
                AI-generated wording from the facts below
              </>
            ) : (
              <>
                <ListChecksIcon aria-hidden="true" className="size-3.5" />
                Generated from the rules
              </>
            )}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Facts</h3>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Promised date</dt>
          <dd>
            <DateText value={promisedDate} />
          </dd>
          <dt className="text-muted-foreground">Evaluated for (UTC date)</dt>
          <dd>
            <DateText value={risk.evaluatedForDate} />
          </dd>
        </dl>

        {risk.reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No risk rule matched: every linked issue is readable, has a due date on or before the promised date, and
            none has the status Blocked.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {risk.reasons.map((reason) => (
              <li key={reason.code} className="rounded-lg border p-3">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{reason.code}</code>
                  <span>{REASON_LABELS[reason.code]}</span>
                </p>
                {reason.evidence.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {reason.evidence.map((evidence) => (
                      <li key={evidence.issueId}>
                        <EvidenceLine evidence={evidence} url={issueUrls.get(evidence.issueId) ?? null} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

function EvidenceLine({ evidence, url }: { evidence: ReasonEvidence; url: string | null }) {
  if (!evidence.issueKey) {
    return <UnreadableIssue />
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
      <ExternalLink href={url}>{evidence.issueKey}</ExternalLink>
      <span className="text-muted-foreground">
        Due <DateText value={evidence.dueDate} />
      </span>
      <span className="text-muted-foreground">Status: {evidence.statusName ?? 'Unknown'}</span>
    </span>
  )
}
