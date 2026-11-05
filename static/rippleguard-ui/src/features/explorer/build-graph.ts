import { MarkerType, type Edge } from '@xyflow/react'
import { EVIDENCE_LABELS, type ImpactGraphView } from '@shared/contracts'
import type { FlowNode } from '@/features/explorer/graph-nodes'

const ISSUE_X = 350
const ISSUE_SPACING = 130
const SUGGESTION_X = 730
const SUGGESTION_SPACING = 140

/** Lays out the read-only impact graph: commitment → linked issues → Teamwork Graph suggestions (left to right). */
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
    // Suggestions sit in a third column, next to the linked issue they relate to.
    const rowOf = new Map(view.linkedIssues.map((issue, index) => [issue.id, index] as const))
    const groups = new Map<string, typeof view.graphContext.nodes>()
    for (const node of view.graphContext.nodes) {
      if (!rowOf.has(node.relatedToIssueId)) continue
      groups.set(node.relatedToIssueId, [...(groups.get(node.relatedToIssueId) ?? []), node])
    }
    let cursor = Number.NEGATIVE_INFINITY
    for (const issue of view.linkedIssues) {
      const group = groups.get(issue.id)
      if (!group) continue
      const issueY = (rowOf.get(issue.id) ?? 0) * ISSUE_SPACING
      let y = Math.max(cursor, issueY - ((group.length - 1) * SUGGESTION_SPACING) / 2)
      for (const node of group) {
        const id = `graph-${node.id}`
        nodes.push({ id, type: 'graph', position: { x: SUGGESTION_X, y }, data: { node }, deletable: false })
        edges.push({
          id: `edge-${id}`,
          source: `issue-${issue.id}`,
          sourceHandle: 'related',
          target: id,
          label: EVIDENCE_LABELS.graphSuggested,
          type: 'smoothstep',
          animated: true,
          deletable: false,
          style: { strokeDasharray: '6 5', strokeWidth: 1.5, opacity: 0.85 },
          labelBgPadding: [6, 3],
          labelBgBorderRadius: 4,
        })
        y += SUGGESTION_SPACING
      }
      cursor = y
    }
  }

  return { nodes, edges }
}
