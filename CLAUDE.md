# CLAUDE.md — RippleGuard scope guard

**Every Claude Code session, subagent, plan, and code edit must follow `AGENTS.md`.** The product specification is frozen. Do not generate features not expressly listed as F01–F08 in `docs/FEATURE_SCOPE.md`.

Before implementation, read in order:
1. `docs/FEATURE_SCOPE.md`
2. `AGENTS.md`
3. `SCOPE_LOCK.json`
4. `docs/ARCHITECTURE.md`
5. `docs/TEST_MATRIX.md`
6. `docs/IMPLEMENTATION_PLAN.md`

Use `.agents/skills/rippleguard-build/SKILL.md` for the approved build procedure when available. Do **not** confuse it with `skills/rippleguard-impact/SKILL.md` (the **runtime** Rovo Agent skill).

If a request lacks an approved feature ID or would add a new screen, action, permission, storage service, integration, agent ability, or background operation, return the exact OUT OF SCOPE response from `AGENTS.md` and do not write code.

Always report which feature ID is implemented, affected files, verified tests, blockers, and `Scope additions: NONE`. Do not claim tests or Atlassian Preview capabilities are working without executing them.
