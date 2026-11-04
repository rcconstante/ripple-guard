import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppError, Result } from '@shared/contracts'
import { call } from '@/lib/call'

export type ResolverState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: AppError }
  | { status: 'success'; data: T; refreshing: boolean }

interface Settled<T> {
  key: string
  nonce: number
  result: Result<T>
}

/**
 * Loads data from a resolver. `key` identifies the request: when it changes,
 * the data reloads. `refetch()` reloads while keeping the current data visible.
 * Loading/refreshing is derived during render, so effects never set state synchronously.
 */
export function useResolver<T>(load: () => Promise<Result<T>>, key: string) {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const [nonce, setNonce] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  useEffect(() => {
    const active = { current: true }
    void call(() => loadRef.current()).then((result) => {
      if (active.current) setSettled({ key, nonce, result })
    })
    return () => {
      active.current = false
    }
  }, [key, nonce])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  let state: ResolverState<T>
  if (!settled || settled.key !== key) {
    state = { status: 'loading' }
  } else if (settled.nonce !== nonce) {
    // A refetch is in flight: keep showing the previous data.
    state = settled.result.ok ? { status: 'success', data: settled.result.data, refreshing: true } : { status: 'loading' }
  } else {
    state = settled.result.ok
      ? { status: 'success', data: settled.result.data, refreshing: false }
      : { status: 'error', error: settled.result.error }
  }

  return { state, refetch }
}
