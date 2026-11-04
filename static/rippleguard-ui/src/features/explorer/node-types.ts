import { CommitmentNode, GraphNode, IssueNode } from '@/features/explorer/graph-nodes'

/** Custom React Flow node renderers (defined once, outside components, as React Flow requires). */
export const nodeTypes = {
  commitment: CommitmentNode,
  issue: IssueNode,
  graph: GraphNode,
}
