import { formatDate, formatTimestampDate } from '@/lib/dates'

/** A date-only value (`YYYY-MM-DD`) shown without timezone conversion. */
export function DateText({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className={className}>—</span>
  return (
    <time dateTime={value} className={className}>
      {formatDate(value)}
    </time>
  )
}

/** The UTC date part of an ISO timestamp. */
export function TimestampDate({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className={className}>—</span>
  return (
    <time dateTime={value} className={className}>
      {formatTimestampDate(value)}
    </time>
  )
}
