import { makeResolver } from '@forge/resolver';
import type { RippleGuardApi } from './shared/contracts';
import { resolvers } from './resolvers';

/** `function: resolver` in manifest.yml. Shared by the global page and the issue panel. */
export const handler = makeResolver<RippleGuardApi>(resolvers);
