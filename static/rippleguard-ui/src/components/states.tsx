import type { ReactNode } from 'react'
import { AlertCircleIcon, InboxIcon, LockIcon, RotateCcwIcon } from 'lucide-react'
import type { AppError } from '@shared/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, errorTitle } from '@/lib/errors'
import { cn } from '@/lib/utils'

export function LoadingState({ label = 'Loading', rows = 3, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-3', className)}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <InboxIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

interface ErrorStateProps {
  error: AppError
  onRetry?: () => void
  className?: string
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const denied = error.code === 'NOT_FOUND' || error.code === 'ISSUE_NOT_ACCESSIBLE' || error.code === 'NOT_OWNER'
  const Icon = denied ? LockIcon : AlertCircleIcon
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center',
        denied ? 'border-border' : 'border-destructive/30 bg-destructive/5',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('size-8', denied ? 'text-muted-foreground' : 'text-destructive')} />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{errorTitle(error)}</p>
        <p className="max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && !denied ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcwIcon aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

/** Visually hidden polite announcement for async results. */
export function LiveMessage({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  )
}
