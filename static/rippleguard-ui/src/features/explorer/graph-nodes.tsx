import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { FlagIcon, SparklesIcon, TicketIcon } from 'lucide-react'
import { EVIDENCE_LABELS, type GraphContextNode, type ImpactGraphView, type LinkedIssueView } from '@shared/contracts'
import { DateText } from '@/components/date-text'
import { ExternalLink } from '@/components/external-link'
import { UnreadableIssue } from '@/components/issue-key-list'
import { LifecycleBadge, RiskBadge } from '@/components/status-badges'

export type CommitmentFlowNode = Node<{ commitment: ImpactGraphView['commitment'] }, 'commitment'>
export type IssueFlowNode = Node<{ issue: LinkedIssueView }, 'issue'>
export type GraphFlowNode = Node<{ node: GraphContextNode }, 'graph'>
export type FlowNode = CommitmentFlowNode | IssueFlowNode | GraphFlowNode

const handleClass = '!size-2 !border-0 !bg-muted-foreground/60'

export function CommitmentNode({ data }: NodeProps<CommitmentFlowNode>) {
  const { commitment } = data
  return (
    <div className="w-64 rounded-xl border-2 border-primary/50 bg-card p-3 text-card-foreground shadow-sm">
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <FlagIcon aria-hidden="true" className="size-3.5" />
        Commitment
      </p>
      <p className="line-clamp-3 text-sm font-semibold">{commitment.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {commitment.customerLabel} · Promised <DateText value={commitment.promisedDate} />
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {commitment.risk ? (
          <RiskBadge status={commitment.risk.status} stale={commitment.risk.stale} />
        ) : (
          <LifecycleBadge lifecycle={commitment.lifecycle} />
        )}
      </div>
      <ExternalLink href={commitment.sourceUrl} showIcon className="nodrag nopan mt-2 text-xs">
        Source
      </ExternalLink>
      <Handle type="source" position={Position.Right} id="issues" className={handleClass} isConnectable={false} />
    </div>
  )
}

export function IssueNode({ data }: NodeProps<IssueFlowNode>) {
  const { issue } = data
  return (
    <div className="w-60 rounded-xl border bg-card p-3 text-card-foreground shadow-sm">
      <Handle type="target" position={Position.Left} className={handleClass} isConnectable={false} />
      <Handle type="source" position={Position.Right} id="related" className={handleClass} isConnectable={false} />
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <TicketIcon aria-hidden="true" className="size-3.5" />
        Jira issue
      </p>
      {issue.readable && issue.key ? (
        <>
          <ExternalLink href={issue.url} className="nodrag nopan text-sm">
            {issue.key}
          </ExternalLink>
          <p className="line-clamp-2 text-xs">{issue.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {issue.statusName ?? 'No status'} · Due <DateText value={issue.dueDate} />
          </p>
        </>
      ) : (
        <UnreadableIssue className="text-xs" />
      )}
    </div>
  )
}

/** A Teamwork Graph suggestion: dashed and labelled, so it never reads as an authoritative link. */
export function GraphNode({ data }: NodeProps<GraphFlowNode>) {
  const { node } = data
  return (
    <div className="w-60 rounded-xl border border-dashed border-muted-foreground/60 bg-muted/40 p-3 text-card-foreground">
      <Handle type="target" position={Position.Left} className={handleClass} isConnectable={false} />
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <SparklesIcon aria-hidden="true" className="size-3.5" />
        {EVIDENCE_LABELS.graphSuggested}
      </p>
      <ExternalLink href={node.url} className="nodrag nopan text-sm">
        {node.issueKey}
      </ExternalLink>
      <p className="line-clamp-2 text-xs">{node.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {node.statusName ?? 'No status'} · Due <DateText value={node.dueDate} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Related to {node.relatedToKey} in Teamwork Graph</p>
    </div>
  )
}
