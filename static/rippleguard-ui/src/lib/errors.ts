import type { AppError, ErrorCode } from '@shared/contracts'

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Some fields need attention.',
  NOT_FOUND: "This commitment doesn't exist or you don't have access to it.",
  NOT_OWNER: 'Only the commitment owner can do this.',
  ISSUE_NOT_ACCESSIBLE: "A linked Jira issue doesn't exist or you don't have access to it.",
  JIRA_UNAVAILABLE: "Jira couldn't be reached. Try again in a moment.",
  INVALID_STATE: "This action isn't available for the commitment's current state.",
  UNSUPPORTED_PROJECT: "The target project doesn't offer the Task issue type, so RippleGuard can't create a mitigation issue there.",
  MITIGATION_EXISTS: 'A mitigation issue already exists for this commitment.',
  MITIGATION_PENDING: 'A previous mitigation attempt could not be confirmed. Check Jira before trying again.',
  JIRA_CREATE_FAILED: "Jira didn't create the issue.",
  CONTEXT_UNAVAILABLE: "RippleGuard couldn't read the Jira context for this view.",
  INTERNAL: 'Something went wrong in RippleGuard.',
}

/** User-facing message for an error; the server message wins when present. */
export function errorMessage(error: AppError): string {
  return error.message?.trim() || DEFAULT_MESSAGES[error.code] || DEFAULT_MESSAGES.INTERNAL
}

export function errorTitle(error: AppError): string {
  switch (error.code) {
    case 'NOT_FOUND':
      return 'Not found or no access'
    case 'ISSUE_NOT_ACCESSIBLE':
      return 'Jira issue not accessible'
    case 'JIRA_UNAVAILABLE':
      return 'Jira unavailable'
    case 'NOT_OWNER':
      return 'Owner only'
    default:
      return "Couldn't complete the request"
  }
}

/** Error used when the resolver call itself fails (network, platform, consent). */
export function transportError(cause: unknown): AppError {
  const detail = cause instanceof Error && cause.message ? ` (${cause.message})` : ''
  return {
    code: 'INTERNAL',
    message: `RippleGuard couldn't reach its backend${detail}. Reload the page to try again.`,
  }
}
