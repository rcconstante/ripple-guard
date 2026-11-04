import type { Handlers } from '@forge/resolver';
import type { RippleGuardApi } from '../shared/contracts';

/**
 * Custom UI resolvers, one per key of `RippleGuardApi`. TypeScript reports an
 * error here until every contract entry has a handler.
 *
 * Each handler receives `{ payload, context }`. Keep handlers thin: validate
 * input, check Jira visibility, then delegate to src/services/.
 */
export const resolvers: Handlers<RippleGuardApi> = {};
