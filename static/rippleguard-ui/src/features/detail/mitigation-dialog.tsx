import { useId, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import type { AppError, CreateMitigationResult, MitigationDraft } from '@shared/contracts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useResolver } from '@/hooks/use-resolver'
import { backend } from '@/lib/backend'
import { call } from '@/lib/call'
import { errorMessage, errorTitle } from '@/lib/errors'

interface MitigationDialogProps {
  commitmentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Set when the owner confirmed a pending attempt was checked in Jira. */
  acknowledgePendingReview: boolean
  onCreated: (result: CreateMitigationResult) => void
}

const SUMMARY_MAX = 255
const DESCRIPTION_MAX = 20000 // matches LIMITS.mitigationDescription on the server

/**
 * F06 review modal. Opening it only previews (no side effect); the Jira issue
 * is created only by "Confirm create issue". Content mounts on open, so every
 * opening starts from a fresh preview.
 */
export function MitigationDialog({ commitmentId, open, onOpenChange, acknowledgePendingReview, onCreated }: MitigationDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review mitigation Jira issue</DialogTitle>
          <DialogDescription>
            Nothing is created until you choose Confirm create issue. The issue is created as you, using your Jira
            permissions.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <MitigationBody
            commitmentId={commitmentId}
            acknowledgePendingReview={acknowledgePendingReview}
            onCancel={() => onOpenChange(false)}
            onSubmittingChange={setSubmitting}
            onCreated={(result) => {
              onCreated(result)
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface MitigationBodyProps {
  commitmentId: string
  acknowledgePendingReview: boolean
  onCancel: () => void
  onSubmittingChange: (submitting: boolean) => void
  onCreated: (result: CreateMitigationResult) => void
}

function MitigationBody({ commitmentId, acknowledgePendingReview, onCancel, onSubmittingChange, onCreated }: MitigationBodyProps) {
  const { state } = useResolver(() => backend('previewMitigation', { id: commitmentId }), `preview:${commitmentId}`)

  if (state.status === 'loading') {
    return (
      <>
        <div role="status" aria-live="polite" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
          Preparing the draft…
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </>
    )
  }

  if (state.status === 'error') {
    return (
      <>
        <Alert variant="destructive">
          <AlertTitle>{errorTitle(state.error)}</AlertTitle>
          <AlertDescription>{errorMessage(state.error)}</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
        </DialogFooter>
      </>
    )
  }

  return (
    <DraftForm
      draft={state.data}
      acknowledgePendingReview={acknowledgePendingReview}
      onCancel={onCancel}
      onSubmittingChange={onSubmittingChange}
      onCreated={onCreated}
    />
  )
}

interface DraftFormProps {
  draft: MitigationDraft
  acknowledgePendingReview: boolean
  onCancel: () => void
  onSubmittingChange: (submitting: boolean) => void
  onCreated: (result: CreateMitigationResult) => void
}

function DraftForm({ draft, acknowledgePendingReview, onCancel, onSubmittingChange, onCreated }: DraftFormProps) {
  const id = useId()
  const [summary, setSummary] = useState(draft.summary)
  const [description, setDescription] = useState(draft.description)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AppError | null>(null)

  const summaryTrimmed = summary.trim()
  const descriptionTrimmed = description.trim()
  const summaryInvalid = !summaryTrimmed || summaryTrimmed.length > SUMMARY_MAX
  const descriptionInvalid = !descriptionTrimmed || descriptionTrimmed.length > DESCRIPTION_MAX

  const confirm = async () => {
    if (submitting || summaryInvalid || descriptionInvalid) return
    setSubmitting(true)
    onSubmittingChange(true)
    setSubmitError(null)
    const result = await call(() =>
      backend('createMitigation', {
        commitmentId: draft.commitmentId,
        summary: summaryTrimmed,
        description: descriptionTrimmed,
        confirm: true,
        ...(acknowledgePendingReview ? { acknowledgePendingReview: true } : {}),
      }),
    )
    setSubmitting(false)
    onSubmittingChange(false)
    if (result.ok) {
      onCreated(result.data)
    } else {
      setSubmitError(result.error)
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm">
          <dt className="text-muted-foreground">Target project</dt>
          <dd className="font-medium">{draft.projectKey}</dd>
          <dt className="text-muted-foreground">Issue type</dt>
          <dd className="font-medium">{draft.issueTypeName}</dd>
          <dt className="text-muted-foreground">Reason codes</dt>
          <dd className="flex flex-wrap gap-1">
            {draft.reasonCodes.map((code) => (
              <code key={code} className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                {code}
              </code>
            ))}
          </dd>
        </dl>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-summary`}>Summary</Label>
          <Input
            id={`${id}-summary`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-invalid={summaryInvalid}
            aria-describedby={`${id}-summary-help`}
            disabled={submitting}
          />
          <p id={`${id}-summary-help`} className="text-xs text-muted-foreground">
            Required, up to {SUMMARY_MAX} characters.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-description`}>Description</Label>
          <Textarea
            id={`${id}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={12}
            // Fixed size: auto-sizing to a long URL line would widen the dialog past the screen.
            className="field-sizing-fixed font-mono text-xs wrap-anywhere"
            aria-invalid={descriptionInvalid}
            aria-describedby={`${id}-description-help`}
            disabled={submitting}
          />
          <p id={`${id}-description-help`} className="text-xs text-muted-foreground">
            Prefilled with the risk reason codes, issue links and evidence link. Possible next steps are labelled as
            suggestions. You can edit before confirming.
          </p>
        </div>

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>{errorTitle(submitError)}</AlertTitle>
            <AlertDescription>{errorMessage(submitError)}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => void confirm()} disabled={submitting || summaryInvalid || descriptionInvalid}>
          {submitting ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
          Confirm create issue
        </Button>
      </DialogFooter>
      <p role="status" aria-live="polite" className="sr-only">
        {submitting ? 'Creating the Jira issue…' : ''}
      </p>
    </>
  )
}
