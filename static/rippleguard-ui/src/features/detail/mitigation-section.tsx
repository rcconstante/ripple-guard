import { useId, useState } from 'react'
import { AlertTriangleIcon, CheckCircle2Icon, WrenchIcon } from 'lucide-react'
import type { CommitmentDetail, CreateMitigationResult } from '@shared/contracts'
import { TimestampDate } from '@/components/date-text'
import { ExternalLink } from '@/components/external-link'
import { Section } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { MitigationDialog } from '@/features/detail/mitigation-dialog'

interface MitigationSectionProps {
  commitment: CommitmentDetail
  onChanged: () => void
}

/** F06: one reviewed mitigation Jira issue per commitment. */
export function MitigationSection({ commitment, onChanged }: MitigationSectionProps) {
  const checkboxId = useId()
  const [open, setOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [retryingPending, setRetryingPending] = useState(false)
  const [result, setResult] = useState<CreateMitigationResult | null>(null)

  const { mitigation, permissions, risk, lifecycle, isOwner } = commitment
  const riskAllowsMitigation = lifecycle === 'active' && (risk?.status === 'at_risk' || risk?.status === 'overdue')
  const canRetryPending = mitigation?.state === 'pending' && isOwner && riskAllowsMitigation

  // F06-T05: nothing to show for On track / Needs review / Fulfilled / Archived without a mitigation.
  if (!mitigation && !permissions.canCreateMitigation && !(riskAllowsMitigation && !isOwner) && !result) {
    return null
  }

  const openDialog = (pending: boolean) => {
    setRetryingPending(pending)
    setOpen(true)
  }

  const onCreated = (created: CreateMitigationResult) => {
    setResult(created)
    setAcknowledged(false)
    onChanged()
  }

  return (
    <Section
      headingId="mitigation-heading"
      title="Mitigation"
      description="Create one reviewed Jira Task to address this risk. RippleGuard never creates or edits Jira work on its own."
    >
      {result && result.referenceSaved ? (
        <Alert>
          <CheckCircle2Icon aria-hidden="true" />
          <AlertTitle>Mitigation issue created</AlertTitle>
          <AlertDescription>
            {result.mitigation.jiraIssueKey ? (
              <ExternalLink href={result.mitigation.url} showIcon>
                {result.mitigation.jiraIssueKey}
              </ExternalLink>
            ) : (
              'The issue was created in Jira.'
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {result && !result.referenceSaved ? (
        <Alert variant="destructive">
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle>Issue created, but RippleGuard couldn't save the link to it</AlertTitle>
          <AlertDescription>
            <span>
              Jira created{' '}
              {result.mitigation.jiraIssueKey ? (
                <ExternalLink href={result.mitigation.url}>{result.mitigation.jiraIssueKey}</ExternalLink>
              ) : (
                'the issue'
              )}
              . RippleGuard may not recognise it. Review it in Jira before trying again so you don't create a duplicate.
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {mitigation?.state === 'created' && !result ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <CheckCircle2Icon aria-hidden="true" className="size-4 text-status-on-track" />
          <span>Mitigation issue:</span>
          {mitigation.jiraIssueKey ? (
            <ExternalLink href={mitigation.url} showIcon>
              {mitigation.jiraIssueKey}
            </ExternalLink>
          ) : (
            <span>created</span>
          )}
          <span className="text-muted-foreground">
            on <TimestampDate value={mitigation.createdAt} />
          </span>
        </p>
      ) : null}

      {mitigation?.state === 'pending' ? (
        <div className="flex flex-col gap-3">
          <Alert>
            <AlertTriangleIcon aria-hidden="true" />
            <AlertTitle>Mitigation attempt not confirmed</AlertTitle>
            <AlertDescription>
              <span>
                RippleGuard started creating a mitigation issue but couldn't confirm it. Check Jira before trying
                again.{' '}
                {mitigation.reconcileSearchUrl ? (
                  <ExternalLink href={mitigation.reconcileSearchUrl} showIcon>
                    Search Jira for this mitigation
                  </ExternalLink>
                ) : null}
              </span>
            </AlertDescription>
          </Alert>
          {canRetryPending ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                />
                <Label htmlFor={checkboxId} className="text-sm font-normal">
                  I checked Jira and no mitigation issue exists
                </Label>
              </div>
              <Button variant="outline" disabled={!acknowledged} onClick={() => openDialog(true)}>
                Review mitigation again
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!mitigation && permissions.canCreateMitigation ? (
        <div>
          <Button onClick={() => openDialog(false)}>
            <WrenchIcon aria-hidden="true" />
            Create mitigation Jira issue
          </Button>
        </div>
      ) : null}

      {!mitigation && !permissions.canCreateMitigation && riskAllowsMitigation && !isOwner ? (
        <p className="text-sm text-muted-foreground">Only the commitment owner can create a mitigation issue.</p>
      ) : null}

      <MitigationDialog
        commitmentId={commitment.id}
        open={open}
        onOpenChange={setOpen}
        acknowledgePendingReview={retryingPending && acknowledged}
        onCreated={onCreated}
      />
    </Section>
  )
}
