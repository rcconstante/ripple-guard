import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react'
import type { AppError, CommitmentDetail, CommitmentInput, FieldErrors } from '@shared/contracts'
import { EVIDENCE_LABELS } from '@shared/contracts'
import { InternalLink } from '@/components/internal-link'
import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingState } from '@/components/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { IssuePicker, type PickedIssue } from '@/features/commitments/issue-picker'
import { LIMITS, validateCommitment } from '@/features/commitments/validation'
import { useResolver } from '@/hooks/use-resolver'
import { siteHost, useAppContext } from '@/lib/app-context'
import { backend } from '@/lib/backend'
import { call } from '@/lib/call'
import { errorMessage, errorTitle } from '@/lib/errors'
import { useRouter } from '@/lib/router-context'
import { paths } from '@/lib/routes'

interface FormValues {
  title: string
  customerLabel: string
  promisedDate: string
  sourceUrl: string
  evidenceExcerpt: string
  issues: PickedIssue[]
}

const EMPTY: FormValues = {
  title: '',
  customerLabel: '',
  promisedDate: '',
  sourceUrl: '',
  evidenceExcerpt: '',
  issues: [],
}

function fromDetail(detail: CommitmentDetail): FormValues {
  return {
    title: detail.title,
    customerLabel: detail.customerLabel,
    promisedDate: detail.promisedDate,
    sourceUrl: detail.sourceUrl,
    evidenceExcerpt: detail.evidenceExcerpt,
    issues: detail.issues.map((issue) => ({
      id: issue.id,
      readable: issue.readable,
      key: issue.key,
      summary: issue.summary,
      statusName: issue.statusName,
      dueDate: issue.dueDate,
      url: issue.url,
    })),
  }
}

function toInput(values: FormValues): CommitmentInput {
  return {
    title: values.title.trim(),
    customerLabel: values.customerLabel.trim(),
    promisedDate: values.promisedDate,
    sourceUrl: values.sourceUrl.trim(),
    evidenceExcerpt: values.evidenceExcerpt.trim(),
    linkedIssueIds: values.issues.map((issue) => issue.id),
  }
}

/** Create form (`/commitments/new`). */
export function NewCommitmentPage() {
  return (
    <CommitmentForm
      mode="create"
      initial={EMPTY}
      backTo={paths.commitments()}
      backLabel="Commitments"
    />
  )
}

/** Edit form (`/commitments/:id/edit`). Owner only, active commitments only. */
export function EditCommitmentPage({ id }: { id: string }) {
  const { state, refetch } = useResolver(() => backend('getCommitment', { id }), `edit:${id}`)
  const back = (
    <InternalLink to={paths.detail(id)} className="inline-flex items-center gap-1">
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Back to commitment
    </InternalLink>
  )

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit commitment" eyebrow={back} />
        <LoadingState label="Loading commitment" rows={5} />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit commitment" eyebrow={back} />
        <ErrorState error={state.error} onRetry={refetch} />
      </div>
    )
  }
  const detail = state.data
  if (!detail.permissions.canEdit) {
    const error: AppError =
      detail.lifecycle !== 'active'
        ? { code: 'INVALID_STATE', message: 'Only active commitments can be edited.' }
        : { code: 'NOT_OWNER', message: 'Only the commitment owner can edit it, while they can view every linked Jira issue.' }
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Edit commitment" eyebrow={back} />
        <ErrorState error={error} />
      </div>
    )
  }
  return (
    <CommitmentForm
      mode="edit"
      id={id}
      initial={fromDetail(detail)}
      backTo={paths.detail(id)}
      backLabel="Back to commitment"
    />
  )
}

interface CommitmentFormProps {
  mode: 'create' | 'edit'
  id?: string
  initial: FormValues
  backTo: string
  backLabel: string
}

function CommitmentForm({ mode, id, initial, backTo, backLabel }: CommitmentFormProps) {
  const { navigate } = useRouter()
  const { siteUrl } = useAppContext()
  const host = siteHost(siteUrl)
  const formId = useId()
  const [values, setValues] = useState<FormValues>(initial)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<AppError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    const fieldKey = key === 'issues' ? 'linkedIssueIds' : key
    setFieldErrors((prev) => ({ ...prev, [fieldKey]: undefined }))
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    const unreadable = values.issues.filter((issue) => !issue.readable)
    const input = toInput(values)
    const errors = validateCommitment(input, host)
    if (unreadable.length > 0 && !errors.linkedIssueIds) {
      errors.linkedIssueIds = 'Remove issues you can no longer view before saving.'
    }
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors)
      focusFirstError(formId, errors)
      return
    }

    setSubmitting(true)
    const result =
      mode === 'create'
        ? await call(() => backend('createCommitment', input))
        : await call(() => backend('updateCommitment', { id: id ?? '', changes: input }))
    setSubmitting(false)

    if (result.ok) {
      navigate(paths.detail(result.data.id))
      return
    }
    if (result.error.code === 'VALIDATION_FAILED' && result.error.fieldErrors) {
      setFieldErrors(result.error.fieldErrors)
      focusFirstError(formId, result.error.fieldErrors)
    }
    setFormError(result.error)
  }

  const excerptLength = values.evidenceExcerpt.trim().length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mode === 'create' ? 'New commitment' : 'Edit commitment'}
        description={
          mode === 'create'
            ? 'Record a customer or partner promise and the Jira work that delivers it.'
            : 'Changing the date, source, excerpt or linked issues recalculates the risk.'
        }
        eyebrow={
          <InternalLink to={backTo} className="inline-flex items-center gap-1">
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            {backLabel}
          </InternalLink>
        }
      />

      <form id={formId} onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-6 rounded-xl border bg-card p-6">
        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>{errorTitle(formError)}</AlertTitle>
            <AlertDescription>{errorMessage(formError)}</AlertDescription>
          </Alert>
        ) : null}

        <Field
          id={`${formId}-title`}
          label="Title"
          help={`What was promised, in ${LIMITS.title.min}–${LIMITS.title.max} characters.`}
          error={fieldErrors.title}
        >
          {(props) => (
            <Input
              {...props}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={LIMITS.title.max + 20}
              autoComplete="off"
            />
          )}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id={`${formId}-customerLabel`}
            label="Customer"
            help="A plain label for the customer or partner."
            error={fieldErrors.customerLabel}
          >
            {(props) => (
              <Input
                {...props}
                value={values.customerLabel}
                onChange={(e) => set('customerLabel', e.target.value)}
                maxLength={LIMITS.customerLabel.max + 20}
                autoComplete="off"
              />
            )}
          </Field>
          <Field
            id={`${formId}-promisedDate`}
            label="Promised date"
            help="The date written in the promise. Compared in UTC."
            error={fieldErrors.promisedDate}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                value={values.promisedDate}
                onChange={(e) => set('promisedDate', e.target.value)}
                className="w-48"
              />
            )}
          </Field>
        </div>

        <Field
          id={`${formId}-sourceUrl`}
          label="Source link"
          help={`An https:// link on this Atlassian site${host ? ` (${host})` : ''}, such as the Confluence page or Jira issue where the promise is written. RippleGuard stores the link but never reads its content.`}
          error={fieldErrors.sourceUrl}
        >
          {(props) => (
            <Input
              {...props}
              type="url"
              inputMode="url"
              value={values.sourceUrl}
              onChange={(e) => set('sourceUrl', e.target.value)}
              placeholder={host ? `https://${host}/wiki/…` : 'https://…'}
              autoComplete="off"
            />
          )}
        </Field>

        <Field
          id={`${formId}-evidenceExcerpt`}
          label={EVIDENCE_LABELS.recordedExcerpt}
          help="Copy the sentence that states the promise. User-attested evidence; not independently verified."
          error={fieldErrors.evidenceExcerpt}
          trailing={
            <span
              className={excerptLength > LIMITS.evidenceExcerpt.max ? 'text-destructive' : 'text-muted-foreground'}
              aria-live="polite"
            >
              {excerptLength}/{LIMITS.evidenceExcerpt.max}
            </span>
          }
        >
          {(props) => (
            <Textarea
              {...props}
              value={values.evidenceExcerpt}
              onChange={(e) => set('evidenceExcerpt', e.target.value)}
              rows={5}
            />
          )}
        </Field>

        <div id={`${formId}-linkedIssueIds`} tabIndex={-1} className="outline-none">
          <IssuePicker
            issues={values.issues}
            onChange={(issues) => set('issues', issues)}
            error={fieldErrors.linkedIssueIds}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-6">
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
            {mode === 'create' ? 'Save commitment' : 'Save changes'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(backTo)} disabled={submitting}>
            Cancel
          </Button>
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {submitting ? 'Saving and checking Jira access…' : ''}
          </p>
        </div>
      </form>
    </div>
  )
}

interface FieldControlProps {
  id: string
  'aria-describedby': string
  'aria-invalid': boolean
}

function Field({
  id,
  label,
  help,
  error,
  trailing,
  children,
}: {
  id: string
  label: string
  help?: string
  error?: string
  trailing?: ReactNode
  children: (props: FieldControlProps) => ReactNode
}) {
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {trailing ? <span className="text-xs tabular-nums">{trailing}</span> : null}
      </div>
      {children({
        id,
        'aria-describedby': [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' '),
        'aria-invalid': Boolean(error),
      })}
      {help ? (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const FIELD_ORDER: Array<keyof CommitmentInput> = [
  'title',
  'customerLabel',
  'promisedDate',
  'sourceUrl',
  'evidenceExcerpt',
  'linkedIssueIds',
]

function focusFirstError(formId: string, errors: FieldErrors) {
  const first = FIELD_ORDER.find((key) => errors[key])
  if (!first) return
  requestAnimationFrame(() => {
    document.getElementById(`${formId}-${first}`)?.focus()
  })
}
