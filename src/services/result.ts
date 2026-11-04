import type { AppError, ErrorCode, FieldErrors, Result } from '../shared/contracts';

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const fail = <T = never>(code: ErrorCode, message: string, fieldErrors?: FieldErrors): Result<T> => {
  const error: AppError = { code, message };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) error.fieldErrors = fieldErrors;
  return { ok: false, error };
};

export const MESSAGES = {
  notFound: "This commitment doesn't exist or you don't have access to all of its linked Jira issues.",
  notOwner: 'Only the commitment owner can do this.',
  jiraUnavailable: 'Jira could not be reached, so access and current data could not be verified. Try again shortly.',
  context: 'RippleGuard could not identify you or this Jira site.',
  internal: 'Something went wrong. Nothing was changed.',
} as const;
