import { makeResolver } from '@forge/resolver';
import type { RippleGuardApi } from './shared/contracts';
import { resolvers } from './resolvers';

/** `function: resolver` in manifest.yml. Shared by the global page and the issue panel. */
export const handler = makeResolver<RippleGuardApi>(resolvers);

/** `function: issue-updated` (trigger on avi:jira:updated:issue). */
export { handleIssueUpdated } from './triggers/issueUpdated';

/** Read-only Rovo actions, also exposed through rovo:mcp. */
export { getCommitmentEvidence, listAtRiskCommitments, previewIssueImpact } from './actions';
