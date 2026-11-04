import type { CommitmentSummary } from '@shared/contracts'

/** Promised date ascending (date-only strings sort lexicographically), then title. */
export function byPromisedDate(a: CommitmentSummary, b: CommitmentSummary): number {
  return a.promisedDate.localeCompare(b.promisedDate) || a.title.localeCompare(b.title)
}
