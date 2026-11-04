import type { Result } from '@shared/contracts'
import { transportError } from '@/lib/errors'

/** Runs a resolver call and turns thrown transport errors into a failed Result. */
export async function call<T>(request: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    const result = await request()
    if (!result || typeof result !== 'object' || !('ok' in result)) {
      return { ok: false, error: transportError(new Error('Unexpected response')) }
    }
    return result
  } catch (cause) {
    return { ok: false, error: transportError(cause) }
  }
}
