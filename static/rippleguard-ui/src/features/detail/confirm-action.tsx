import { useState, type ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'
import type { AppError, Result } from '@shared/contracts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { call } from '@/lib/call'
import { errorMessage } from '@/lib/errors'

interface ConfirmActionProps {
  trigger: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => Promise<Result<unknown>>
  onDone: () => void
}

/** Explicit confirmation for owner lifecycle actions (fulfill / archive). */
export function ConfirmAction({ trigger, title, description, confirmLabel, destructive, onConfirm, onDone }: ConfirmActionProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AppError | null>(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    const result = await call(onConfirm)
    setBusy(false)
    if (result.ok) {
      setOpen(false)
      onDone()
    } else {
      setError(result.error)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          {/* A plain button keeps the dialog open until the server confirms. */}
          <Button variant={destructive ? 'destructive' : 'default'} onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2Icon aria-hidden="true" className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
