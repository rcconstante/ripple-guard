import type { MouseEvent } from 'react'
import type { CommitmentSummary } from '@shared/contracts'
import { DateText } from '@/components/date-text'
import { InternalLink } from '@/components/internal-link'
import { IssueKeyList } from '@/components/issue-key-list'
import { LifecycleBadge, RiskBadge } from '@/components/status-badges'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRouter } from '@/lib/router-context'
import { paths } from '@/lib/routes'

/** Issue IDs cited as evidence by the commitment's risk reasons. */
function evidenceIssueIds(commitment: CommitmentSummary): Set<string> {
  const ids = new Set<string>()
  for (const reason of commitment.risk?.reasons ?? []) {
    for (const evidence of reason.evidence) ids.add(evidence.issueId)
  }
  return ids
}

interface CommitmentsTableProps {
  commitments: CommitmentSummary[]
  caption: string
  showLifecycle?: boolean
}

export function CommitmentsTable({ commitments, caption, showLifecycle = false }: CommitmentsTableProps) {
  const { navigate } = useRouter()

  const onRowClick = (event: MouseEvent<HTMLTableRowElement>, id: string) => {
    // Inner links and buttons handle their own clicks.
    if ((event.target as HTMLElement).closest('a,button')) return
    navigate(paths.detail(id))
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-56">Title</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>
              Promised date <span className="sr-only">(sorted ascending)</span>
            </TableHead>
            {showLifecycle ? <TableHead>Lifecycle</TableHead> : null}
            <TableHead>Risk</TableHead>
            <TableHead className="min-w-40">Affected Jira issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commitments.map((commitment) => (
            <TableRow
              key={commitment.id}
              onClick={(event) => onRowClick(event, commitment.id)}
              className="cursor-pointer"
            >
              <TableCell className="max-w-80 whitespace-normal">
                <InternalLink to={paths.detail(commitment.id)} className="line-clamp-2 text-foreground">
                  {commitment.title}
                </InternalLink>
              </TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground" title={commitment.customerLabel}>
                {commitment.customerLabel}
              </TableCell>
              <TableCell className="tabular-nums">
                <DateText value={commitment.promisedDate} />
              </TableCell>
              {showLifecycle ? (
                <TableCell>
                  <LifecycleBadge lifecycle={commitment.lifecycle} />
                </TableCell>
              ) : null}
              <TableCell>
                {commitment.risk ? (
                  <RiskBadge status={commitment.risk.status} stale={commitment.risk.stale} />
                ) : (
                  <span className="text-sm text-muted-foreground">Not evaluated</span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">
                <IssueKeyList issues={commitment.issues} emphasize={evidenceIssueIds(commitment)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

