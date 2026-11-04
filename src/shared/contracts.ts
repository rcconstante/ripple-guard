/**
 * Resolver contract shared by the Forge backend (src/) and the Custom UI
 * (static/rippleguard-ui). Types only, no runtime imports: this file is
 * compiled by both the Forge bundler (TypeScript 5.9) and the frontend (TypeScript 7).
 *
 * Add one entry per resolver as you build F01–F08, using the names in
 * docs/ARCHITECTURE.md §D. The signature is `(payload) => result`; use
 * `() => result` for resolvers without a payload. For example:
 *
 *   listCommitments: () => CommitmentSummary[];
 *   getCommitment: (input: { id: string }) => CommitmentDetail;
 *
 * Backend:  makeResolver<RippleGuardApi>(resolvers)   (src/index.ts)
 * Frontend: makeInvoke<RippleGuardApi>()              (static/rippleguard-ui/src/lib/backend.ts)
 */
export type RippleGuardApi = {};
