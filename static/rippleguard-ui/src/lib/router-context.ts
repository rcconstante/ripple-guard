import { createContext, useContext } from 'react'
import type { Route } from '@/lib/routes'

export interface RouterValue {
  route: Route
  path: string
  navigate: (path: string) => void
}

export const RouterContext = createContext<RouterValue | null>(null)

export function useRouter(): RouterValue {
  const value = useContext(RouterContext)
  if (!value) throw new Error('useRouter must be used inside <RouterProvider>')
  return value
}
