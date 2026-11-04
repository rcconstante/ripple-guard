import { view } from '@forge/bridge'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { RouterContext, type RouterValue } from '@/lib/router-context'
import { normalizePath, parseRoute } from '@/lib/routes'

/** Minimal shape of the history object returned by `view.createHistory()`. */
interface HostHistory {
  location?: { pathname?: string }
  push: (path: string) => void
  listen: (listener: (update: unknown) => void) => (() => void) | void
}

function pathFromUpdate(update: unknown): string | undefined {
  if (!update || typeof update !== 'object') return undefined
  // Forge passes the location; history v5 passes { location }.
  const maybe = update as { pathname?: unknown; location?: { pathname?: unknown } }
  if (typeof maybe.pathname === 'string') return maybe.pathname
  if (typeof maybe.location?.pathname === 'string') return maybe.location.pathname
  return undefined
}

/**
 * In-page routing for the global page. Uses the Jira host history so the
 * browser URL and back button follow the app; falls back to in-memory routing
 * when the host history is unavailable (for example, plain Vite in a browser).
 */
export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState('/')
  const [ready, setReady] = useState(false)
  const historyRef = useRef<HostHistory | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | void
    const active = { current: true }
    view
      .createHistory()
      .then((history) => {
        if (!active.current) return
        const host = history as unknown as HostHistory
        historyRef.current = host
        setPath(normalizePath(host.location?.pathname))
        unlisten = host.listen((update) => {
          const next = pathFromUpdate(update)
          if (next !== undefined) setPath(normalizePath(next))
        })
      })
      .catch(() => {
        historyRef.current = null
      })
      .finally(() => {
        if (active.current) setReady(true)
      })
    return () => {
      active.current = false
      if (typeof unlisten === 'function') unlisten()
    }
  }, [])

  const navigate = useCallback((next: string) => {
    const target = normalizePath(next)
    const host = historyRef.current
    if (host) {
      try {
        host.push(target)
      } catch {
        // Fall through to local state below.
      }
    }
    setPath(target)
    window.scrollTo?.({ top: 0 })
  }, [])

  const value = useMemo<RouterValue>(
    () => ({ route: parseRoute(path), path, navigate }),
    [path, navigate],
  )

  if (!ready) return null
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}
