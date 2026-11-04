import { makeInvoke } from '@forge/bridge'
import type { RippleGuardApi } from '@shared/contracts'

/**
 * Typed resolver calls: `await backend('listCommitments')`.
 * Contract lives in src/shared/contracts.ts; handlers in src/resolvers/.
 */
export const backend = makeInvoke<RippleGuardApi>()
