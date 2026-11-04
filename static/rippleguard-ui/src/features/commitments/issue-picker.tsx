import { useId, useState, type KeyboardEvent } from 'react'
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { DateText } from '@/components/date-text'
import { ExternalLink } from '@/components/external-link'
import { UnreadableIssue } from '@/components/issue-key-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIMITS } from '@/features/commitments/validation'
import { backend } from '@/lib/backend'
import { call } from '@/lib/call'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

/** An issue selected in the form. Unreadable issues come only from an existing record (edit mode). */
export interface PickedIssue {
  id: string
  readable: boolean
  key: string | null
  summary: string | null
  statusName: string | null
  dueDate: string | null
  url: string | null
}

interface IssuePickerProps {
  issues: PickedIssue[]
  onChange: (issues: PickedIssue[]) => void
  error?: string
  disabled?: boolean
}

export function IssuePicker({ issues, onChange, error, disabled }: IssuePickerProps) {
  const inputId = useId()
  const helpId = `${inputId}-help`
  const errorId = `${inputId}-error`
  const [query, setQuery] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const full = issues.length >= LIMITS.linkedIssues.max

  const add = async () => {
    const value = query.trim()
    if (!value || looking || full) return
    setLooking(true)
    setLookupError(null)
    const result = await call(() => backend('lookupIssue', { query: value }))
    setLooking(false)
    if (!result.ok) {
      setLookupError(errorMessage(result.error))
      return
    }
    const found = result.data
    if (issues.some((issue) => issue.id === found.id)) {
      setLookupError(`${found.key} is already linked.`)
      return
    }
    onChange([
      ...issues,
      {
        id: found.id,
        readable: true,
        key: found.key,
        summary: found.summary,
        statusName: found.statusName,
        dueDate: found.dueDate,
        url: found.url,
      },
    ])
    setQuery('')
    setAnnouncement(`Added ${found.key}`)
  }

  const remove = (issue: PickedIssue) => {
    onChange(issues.filter((i) => i.id !== issue.id))
    setAnnouncement(`Removed ${issue.key ?? 'unreadable issue'}`)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void add()
    }
  }

  const describedBy = [helpId, lookupError || error ? errorId : null].filter(Boolean).join(' ')

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium">Linked Jira issues</legend>
      <p id={helpId} className="text-sm text-muted-foreground">
        Add 1–{LIMITS.linkedIssues.max} existing issues by key (e.g. PROJ-123) or by their link on this site. You must
        be able to view each issue.
      </p>
      <div className="flex gap-2">
        <Label htmlFor={inputId} className="sr-only">
          Issue key or URL
        </Label>
        <Input
          id={inputId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setLookupError(null)
          }}
          onKeyDown={onKeyDown}
          placeholder="Issue key or URL"
          aria-describedby={describedBy}
          aria-invalid={Boolean(lookupError || error)}
          disabled={disabled || full}
          autoComplete="off"
          className="max-w-sm"
        />
        <Button type="button" variant="outline" onClick={() => void add()} disabled={disabled || full || looking || !query.trim()}>
          {looking ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : <PlusIcon aria-hidden="true" />}
          Add
        </Button>
      </div>
      {full ? <p className="text-sm text-muted-foreground">Maximum of {LIMITS.linkedIssues.max} issues reached.</p> : null}
      {lookupError || error ? (
        <p id={errorId} className="text-sm text-destructive">
          {lookupError ?? error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {looking ? 'Looking up issue…' : announcement}
      </p>

      {issues.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border">
          {issues.map((issue) => (
            <li key={issue.id} className={cn('flex items-center gap-3 px-3 py-2 text-sm', !issue.readable && 'bg-muted/40')}>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
                {issue.readable && issue.key ? (
                  <>
                    <ExternalLink href={issue.url}>{issue.key}</ExternalLink>
                    <span className="min-w-0 truncate">{issue.summary}</span>
                    <span className="text-muted-foreground">{issue.statusName ?? 'No status'}</span>
                    <span className="text-muted-foreground">
                      Due <DateText value={issue.dueDate} />
                    </span>
                  </>
                ) : (
                  <>
                    <UnreadableIssue />
                    <span className="text-muted-foreground">Remove it or regain access before saving.</span>
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(issue)}
                aria-label={`Remove ${issue.key ?? 'unreadable issue'}`}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  )
}
