import { MarkerType, type Edge } from '@xyflow/react'
import { EVIDENCE_LABELS, type ImpactGraphView } from '@shared/contracts'
import type { FlowNode } from '@/features/explorer/graph-nodes'

const ISSUE_X = 400
const ISSUE_SPACING = 130
const GRAPH_SPACING = 270

/** Lays out the read-only impact graph: commitment → linked issues (right), graph context (below). */
export function buildGraph(view: ImpactGraphView): { nodes: FlowNode[]; edges: Edge[] } {
  const issueCount = view.linkedIssues.length
  const issuesHeight = Math.max(0, (issueCount - 1) * ISSUE_SPACING)
  const commitmentY = issuesHeight / 2 - 40

  const nodes: FlowNode[] = [
    {
      id: 'commitment',
      type: 'commitment',
      position: { x: 0, y: commitmentY },
      data: { commitment: view.commitment },
      deletable: false,
    },
  ]
  const edges: Edge[] = []

  view.linkedIssues.forEach((issue, index) => {
    const id = `issue-${issue.id}`
    nodes.push({
      id,
      type: 'issue',
      position: { x: ISSUE_X, y: index * ISSUE_SPACING },
      data: { issue },
      deletable: false,
    })
    edges.push({
      id: `edge-${id}`,
      source: 'commitment',
      sourceHandle: 'issues',
      target: id,
      label: EVIDENCE_LABELS.linkedByUser,
      type: 'smoothstep',
      deletable: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
    })
  })

  if (view.graphContext.status === 'available') {
    const top = Math.max(issuesHeight, commitmentY + 200) + 160
    view.graphContext.nodes.forEach((node, index) => {
      const id = `graph-${node.id}`
      nodes.push({
        id,
        type: 'graph',
        position: { x: index * GRAPH_SPACING - 20, y: top },
        data: { node },
        deletable: false,
      })
      edges.push({
        id: `edge-${id}`,
        source: 'commitment',
        sourceHandle: 'graph',
        target: id,
        label: EVIDENCE_LABELS.graphSuggested,
        type: 'smoothstep',
        deletable: false,
        style: { strokeDasharray: '6 5', strokeWidth: 1.5, opacity: 0.8 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
      })
    })
  }

  return { nodes, edges }
}
