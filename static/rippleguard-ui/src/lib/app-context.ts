import { createContext, useContext } from 'react'

/** The parts of the Forge view context the UI needs. */
export interface AppContextValue {
  siteUrl: string
  localId: string
  environmentId: string | null
  moduleKey: string
  extensionType: string
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useAppContext must be used inside <AppContext.Provider>')
  return value
}

/** Host name of the current Atlassian site, or null if unknown. */
export function siteHost(siteUrl: string): string | null {
  try {
    return new URL(siteUrl).host.toLowerCase()
  } catch {
    return null
  }
}
