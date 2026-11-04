import { EyeOffIcon } from 'lucide-react'
import type { LinkedIssueView } from '@shared/contracts'
import { ExternalLink } from '@/components/external-link'
import { cn } from '@/lib/utils'

export function UnreadableIssue({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-muted-foreground italic', className)}>
      <EyeOffIcon aria-hidden="true" className="size-3.5" />
      Issue not readable
    </span>
  )
}

/** Compact, wrapping list of linked Jira issue keys. `emphasize` marks keys cited by risk reasons. */
export function IssueKeyList({
  issues,
  emphasize,
  className,
}: {
  issues: LinkedIssueView[]
  emphasize?: ReadonlySet<string>
  className?: string
}) {
  if (issues.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <ul className={cn('flex flex-wrap gap-x-3 gap-y-1', className)}>
      {issues.map((issue) => (
        <li key={issue.id} className="text-sm">
          {issue.readable && issue.key ? (
            <ExternalLink
              href={issue.url}
              title={issue.summary ?? undefined}
              className={cn(emphasize && !emphasize.has(issue.id) && 'font-normal')}
            >
              {issue.key}
            </ExternalLink>
          ) : (
            <UnreadableIssue />
          )}
        </li>
      ))}
    </ul>
  )
}
