import type { CommitmentInput, FieldErrors } from '@shared/contracts'
import { isDateOnly } from '@/lib/dates'

export const LIMITS = {
  title: { min: 5, max: 140 },
  customerLabel: { min: 1, max: 120 },
  evidenceExcerpt: { min: 10, max: 1000 },
  linkedIssues: { min: 1, max: 10 },
} as const

/**
 * Client-side checks mirroring the server rules, for fast feedback only.
 * The server is authoritative and returns its own field errors.
 */
export function validateCommitment(input: CommitmentInput, siteHost: string | null): FieldErrors {
  const errors: FieldErrors = {}
  const title = input.title.trim()
  if (title.length < LIMITS.title.min || title.length > LIMITS.title.max) {
    errors.title = `Enter ${LIMITS.title.min}–${LIMITS.title.max} characters.`
  }
  const customer = input.customerLabel.trim()
  if (customer.length < LIMITS.customerLabel.min || customer.length > LIMITS.customerLabel.max) {
    errors.customerLabel = `Enter ${LIMITS.customerLabel.min}–${LIMITS.customerLabel.max} characters.`
  }
  if (!isDateOnly(input.promisedDate)) {
    errors.promisedDate = 'Choose a valid date.'
  }
  const url = input.sourceUrl.trim()
  if (!url) {
    errors.sourceUrl = 'Enter the link to the source of the promise.'
  } else {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:') {
        errors.sourceUrl = 'Use an https:// link.'
      } else if (siteHost && parsed.host.toLowerCase() !== siteHost) {
        errors.sourceUrl = `Use a link on this Atlassian site (${siteHost}).`
      }
    } catch {
      errors.sourceUrl = 'Enter a valid URL.'
    }
  }
  const excerpt = input.evidenceExcerpt.trim()
  if (excerpt.length < LIMITS.evidenceExcerpt.min || excerpt.length > LIMITS.evidenceExcerpt.max) {
    errors.evidenceExcerpt = `Enter ${LIMITS.evidenceExcerpt.min}–${LIMITS.evidenceExcerpt.max} characters.`
  }
  const ids = input.linkedIssueIds
  if (ids.length < LIMITS.linkedIssues.min) {
    errors.linkedIssueIds = 'Link at least one Jira issue.'
  } else if (ids.length > LIMITS.linkedIssues.max) {
    errors.linkedIssueIds = `Link at most ${LIMITS.linkedIssues.max} Jira issues.`
  } else if (new Set(ids).size !== ids.length) {
    errors.linkedIssueIds = 'Each Jira issue can be linked only once.'
  }
  return errors
}
