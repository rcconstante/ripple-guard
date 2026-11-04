import { useMemo, useState, type ReactNode } from 'react'
import { ArchiveIcon, ArrowLeftIcon, CheckIcon, NetworkIcon, PencilIcon } from 'lucide-react'
import { EVIDENCE_LABELS, type CommitmentDetail } from '@shared/contracts'
import { DateText, TimestampDate } from '@/components/date-text'
import { ExternalLink } from '@/components/external-link'
import { InternalLink } from '@/components/internal-link'
import { UnreadableIssue } from '@/components/issue-key-list'
import { PageHeader, Section } from '@/components/page-header'
import { ErrorState, LiveMessage, LoadingState } from '@/components/states'
import { LifecycleBadge, RiskBadge } from '@/components/status-badges'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmAction } from '@/features/detail/confirm-action'
import { MitigationSection } from '@/features/detail/mitigation-section'
import { RiskSection } from '@/features/detail/risk-section'
import { useResolver } from '@/hooks/use-resolver'
import { backend } from '@/lib/backend'
import { useRouter } from '@/lib/router-context'
import { paths } from '@/lib/routes'

export function CommitmentDetailPage({ id }: { id: string }) {
  const { state, refetch } = useResolver(() => backend('getCommitment', { id }), `detail:${id}`)
  const [message, setMessage] = useState('')

  const back = (
    <InternalLink to={paths.commitments()} className="inline-flex items-center gap-1">
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Commitments
    </InternalLink>
  )

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Commitment" eyebrow={back} />
        <LoadingState label="Loading commitment" rows={5} />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Commitment" eyebrow={back} />
        <ErrorState error={state.error} onRetry={refetch} />
      </div>
    )
  }

  return (
    <DetailView
      commitment={state.data}
      back={back}
      refreshing={state.refreshing}
      message={message}
      onChanged={(text) => {
        setMessage(text)
        refetch()
      }}
    />
  )
}

interface DetailViewProps {
  commitment: CommitmentDetail
  back: ReactNode
  refreshing: boolean
  message: string
  onChanged: (message: string) => void
}

function DetailView({ commitment, back, refreshing, message, onChanged }: DetailViewProps) {
  const { navigate } = useRouter()
  const { permissions } = commitment
  const issueUrls = useMemo(
    () => new Map(commitment.issues.map((issue) => [issue.id, issue.url] as const)),
    [commitment.issues],
  )

  const actions = (
    <>
      <Button variant="outline" onClick={() => navigate(paths.impact(commitment.id))}>
        <NetworkIcon aria-hidden="true" />
        View impact
      </Button>
      {permissions.canEdit ? (
        <Button variant="outline" onClick={() => navigate(paths.edit(commitment.id))}>
          <PencilIcon aria-hidden="true" />
          Edit
        </Button>
      ) : null}
      {permissions.canFulfill ? (
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <CheckIcon aria-hidden="true" />
              Mark fulfilled
            </Button>
          }
          title="Mark this commitment fulfilled?"
          description="Confirm that the promise was delivered. RippleGuard stops evaluating its risk and removes it from the active counts. A Done status in Jira never does this automatically."
          confirmLabel="Mark fulfilled"
          onConfirm={() => backend('fulfillCommitment', { id: commitment.id, confirm: true })}
          onDone={() => onChanged('Commitment marked fulfilled')}
        />
      ) : null}
      {permissions.canArchive ? (
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <ArchiveIcon aria-hidden="true" />
              Archive
            </Button>
          }
          title="Archive this commitment?"
          description="Archived commitments are excluded from the dashboard and from Jira change tracking. Archived commitments can't be restored."
          confirmLabel="Archive"
          destructive
          onConfirm={() => backend('archiveCommitment', { id: commitment.id, confirm: true })}
          onDone={() => onChanged('Commitment archived')}
        />
      ) : null}
    </>
  )

  return (
    <div className="flex flex-col gap-6" aria-busy={refreshing}>
      <LiveMessage message={refreshing ? 'Refreshing…' : message} />
      <PageHeader
        eyebrow={back}
        title={commitment.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{commitment.customerLabel}</span>
            <span aria-hidden="true">·</span>
            <LifecycleBadge lifecycle={commitment.lifecycle} />
            {commitment.risk ? <RiskBadge status={commitment.risk.status} stale={commitment.risk.stale} /> : null}
          </span>
        }
        actions={actions}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {commitment.lifecycle === 'active' && commitment.risk ? (
            <RiskSection
              risk={commitment.risk}
              promisedDate={commitment.promisedDate}
              explanation={commitment.explanation}
              issueUrls={issueUrls}
            />
          ) : (
            <Section headingId="state-heading" title="Status">
              <p className="text-sm text-muted-foreground">
                This commitment is {commitment.lifecycle === 'fulfilled' ? 'fulfilled' : 'archived'}. RippleGuard no
                longer evaluates its risk.
              </p>
            </Section>
          )}

          <Section
            headingId="issues-heading"
            title="Linked Jira issues"
            description={`${EVIDENCE_LABELS.linkedByUser}. Shown with their current Jira data.`}
          >
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <caption className="sr-only">Jira issues linked to this commitment</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commitment.issues.map((issue) =>
                    issue.readable && issue.key ? (
                      <TableRow key={issue.id}>
                        <TableCell>
                          <ExternalLink href={issue.url}>{issue.key}</ExternalLink>
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-normal">{issue.summary}</TableCell>
                        <TableCell>{issue.statusName ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">
                          <DateText value={issue.dueDate} />
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={issue.id}>
                        <TableCell colSpan={4}>
                          <UnreadableIssue />
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          </Section>

          {commitment.lifecycle === 'active' || commitment.mitigation ? (
            <MitigationSection commitment={commitment} onChanged={() => onChanged('Mitigation updated')} />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section headingId="details-heading" title="Details">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Promised date</dt>
              <dd>
                <DateText value={commitment.promisedDate} />
              </dd>
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="break-words">{commitment.customerLabel}</dd>
              <dt className="text-muted-foreground">Owner</dt>
              <dd>{commitment.isOwner ? 'You' : 'Another Jira user'}</dd>
              <dt className="text-muted-foreground">Lifecycle</dt>
              <dd>
                <LifecycleBadge lifecycle={commitment.lifecycle} />
              </dd>
              {commitment.fulfilledAt ? (
                <>
                  <dt className="text-muted-foreground">Fulfilled</dt>
                  <dd>
                    <TimestampDate value={commitment.fulfilledAt} />
                  </dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Created</dt>
              <dd>
                <TimestampDate value={commitment.createdAt} />
              </dd>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>
                <TimestampDate value={commitment.updatedAt} />
              </dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="min-w-0 break-all">
                <ExternalLink href={commitment.sourceUrl} showIcon>
                  {commitment.sourceUrl}
                </ExternalLink>
              </dd>
            </dl>
          </Section>

          <Section
            headingId="excerpt-heading"
            title={EVIDENCE_LABELS.recordedExcerpt}
            description="User-attested evidence; not independently verified."
          >
            <blockquote className="border-l-2 pl-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
              {commitment.evidenceExcerpt}
            </blockquote>
          </Section>
        </div>
      </div>
    </div>
  )
}
