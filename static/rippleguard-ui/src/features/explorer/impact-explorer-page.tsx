import { useMemo } from 'react'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import { ArrowLeftIcon, InfoIcon } from 'lucide-react'
import { EVIDENCE_LABELS, type ImpactGraphView } from '@shared/contracts'
import { DateText } from '@/components/date-text'
import { ExternalLink } from '@/components/external-link'
import { InternalLink } from '@/components/internal-link'
import { UnreadableIssue } from '@/components/issue-key-list'
import { PageHeader, Section } from '@/components/page-header'
import { ErrorState, LoadingState } from '@/components/states'
import { LifecycleBadge, RiskBadge } from '@/components/status-badges'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buildGraph } from '@/features/explorer/build-graph'
import { nodeTypes } from '@/features/explorer/node-types'
import { useIsDark } from '@/hooks/use-is-dark'
import { useResolver } from '@/hooks/use-resolver'
import { backend } from '@/lib/backend'
import { paths } from '@/lib/routes'

export function ImpactExplorerPage({ id }: { id: string }) {
  const { state, refetch } = useResolver(() => backend('getImpactGraph', { id }), `impact:${id}`)
  const back = (
    <InternalLink to={paths.detail(id)} className="inline-flex items-center gap-1">
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Back to commitment
    </InternalLink>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={back}
        title="Impact Explorer"
        description={
          state.status === 'success'
            ? state.data.commitment.title
            : 'The commitment, the Jira issues linked to it, and optional Teamwork Graph context.'
        }
      />
      {state.status === 'loading' ? <LoadingState label="Loading impact graph" rows={4} /> : null}
      {state.status === 'error' ? <ErrorState error={state.error} onRetry={refetch} /> : null}
      {state.status === 'success' ? <ExplorerView view={state.data} /> : null}
    </div>
  )
}

function ExplorerView({ view }: { view: ImpactGraphView }) {
  const dark = useIsDark()
  const { nodes, edges } = useMemo(() => buildGraph(view), [view])
  const graphAvailable = view.graphContext.status === 'available' && view.graphContext.nodes.length > 0

  return (
    <>
      <Legend />
      {!graphAvailable ? (
        <Alert>
          <InfoIcon aria-hidden="true" />
          <AlertDescription>{view.graphContext.message ?? EVIDENCE_LABELS.graphUnavailable}</AlertDescription>
        </Alert>
      ) : null}

      <div
        className="h-[520px] overflow-hidden rounded-xl border bg-card"
        role="figure"
        aria-label="Impact graph. The same information is listed as text below."
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={dark ? 'dark' : 'light'}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.75}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <GraphTextList view={view} graphAvailable={graphAvailable} />
    </>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Graph legend">
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width="36" height="8" className="text-foreground">
          <line x1="0" y1="4" x2="36" y2="4" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span>
          <strong className="font-medium">{EVIDENCE_LABELS.linkedByUser}</strong>: authoritative links used for risk
        </span>
      </li>
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width="36" height="8" className="text-muted-foreground">
          <line x1="0" y1="4" x2="36" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 5" />
        </svg>
        <span>
          <strong className="font-medium">{EVIDENCE_LABELS.graphSuggested}</strong>: related content from Teamwork
          Graph; never used for risk and not proof of a commitment
        </span>
      </li>
    </ul>
  )
}

/** Text version of the graph for keyboard and screen-reader users. */
function GraphTextList({ view, graphAvailable }: { view: ImpactGraphView; graphAvailable: boolean }) {
  const { commitment } = view
  return (
    <Section headingId="graph-text-heading" title="Graph details" description="Everything shown in the graph, as a list.">
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">Commitment</h3>
          <p className="flex flex-wrap items-center gap-2">
            <span>{commitment.title}</span>
            <span className="text-muted-foreground">
              {commitment.customerLabel} · Promised <DateText value={commitment.promisedDate} />
            </span>
            {commitment.risk ? (
              <RiskBadge status={commitment.risk.status} stale={commitment.risk.stale} />
            ) : (
              <LifecycleBadge lifecycle={commitment.lifecycle} />
            )}
            <ExternalLink href={commitment.sourceUrl} showIcon>
              Source
            </ExternalLink>
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{EVIDENCE_LABELS.linkedByUser}</h3>
          {view.linkedIssues.length === 0 ? (
            <p className="text-muted-foreground">No linked issues.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {view.linkedIssues.map((issue) => (
                <li key={issue.id} className="flex flex-wrap items-center gap-x-3">
                  {issue.readable && issue.key ? (
                    <>
                      <ExternalLink href={issue.url}>{issue.key}</ExternalLink>
                      <span>{issue.summary}</span>
                      <span className="text-muted-foreground">
                        {issue.statusName ?? 'No status'} · Due <DateText value={issue.dueDate} />
                      </span>
                    </>
                  ) : (
                    <UnreadableIssue />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{EVIDENCE_LABELS.graphSuggested}</h3>
          {graphAvailable ? (
            <ul className="flex flex-col gap-1">
              {view.graphContext.nodes.map((node) => (
                <li key={node.id}>
                  <ExternalLink href={node.url} showIcon>
                    {node.title}
                  </ExternalLink>{' '}
                  <span className="text-muted-foreground">(Confluence page)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{view.graphContext.message ?? EVIDENCE_LABELS.graphUnavailable}</p>
          )}
        </div>
      </div>
    </Section>
  )
}
