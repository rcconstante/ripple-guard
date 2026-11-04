const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const formatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * Formats a date-only `YYYY-MM-DD` string without any local-timezone shift.
 * Returns the input unchanged if it is not a valid date-only string.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const match = DATE_ONLY.exec(value)
  if (!match) return value
  const [, y, m, d] = match
  const time = Date.UTC(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(time) ? value : formatter.format(time)
}

/** Formats the UTC date part of an ISO timestamp (audit metadata is shown as a date only). */
export function formatTimestampDate(value: string | null | undefined): string {
  if (!value) return '—'
  return formatDate(value.slice(0, 10))
}

export function isDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value)
  if (!match) return false
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return date.toISOString().slice(0, 10) === value
}
