# Approved Technical Architecture — RippleGuard v1.0

## A. Stack and boundaries

A **Jira-first Atlassian Forge** app. No separate host or database.

- `static/rippleguard-ui/`: React/TypeScript/Vite Custom UI, Tailwind, accessible UI primitives, React Flow. Four client-side views only.
- `src/resolvers/`: scoped operations invoked by frontend with `@forge/bridge`.
- `src/services/commitments.ts`: validation and app KVS persistence.
- `src/services/jira.ts`: authorized Jira reads and explicit user-confirmed mitigation issue create.
- `src/services/riskEngine.ts`: pure deterministic status evaluation.
- `src/services/graph.ts`: Teamwork Graph read-only enrichment; gracefully disabled if unavailable.
- `src/services/ai.ts`: short grounded wording for UI; never classification.
- `src/triggers/issueUpdated.ts`: one Jira issue-updated trigger; event filtering, fresh fetch, idempotency.
- `src/actions/`: exactly three read-only Rovo/MCP action handlers.
- `skills/rippleguard-impact/`: runtime Rovo Skill, not a code-generation prompt.
- `prompts/rovo-agent.txt`: permanent Rovo persona and limits.

Actual generated template paths may vary; keep these boundaries even if directory names are adapted to Forge's current template.

## B. Forge manifest requirements (not a copied full manifest)

Declare only these module types if needed for F01–F08: `jira:globalPage`, `jira:issuePanel`, `trigger`, `function`, `llm`, `action`, `rovo:agent`, `rovo:skill`, `rovo:mcp`. `resources` and `permissions` entries support those modules. Do not copy an unverified manifest snippet or add unrelated product modules.

- Custom UI resource and resolver must be wired to the `jira:globalPage` and `jira:issuePanel` modules.
- Trigger event must be `avi:jira:updated:issue`.
- Rovo Agent has 3 referenced read actions and 1 referenced skill.
- `rovo:skill` refers to `skills/rippleguard-impact` and declares the same 3 tool dependencies.
- `rovo:mcp` advertises the same 3 actions and no additional tools.
- `llm` module must be present if using `@forge/llm`.
- Add only currently documented Jira read/write, Forge `storage:app`, Teamwork Graph object scopes and any required Rovo permissions; verify against current official docs and tested APIs. Never copy broad scopes from tutorials without justification.

## C. Storage model and keys

Forge KVS keys are installation-scoped. Use namespaced keys and avoid unbounded key sizes.

```text
commitment:<id>                 → Commitment
risk:<commitmentId>             → RiskSnapshot
mitigation:<commitmentId>       → MitigationReference
issue-index:<jiraIssueId>       → unique commitment IDs that explicitly link this issue
```

Tenant isolation: verify installation context on every request and never share KVS records between installations. Store only the minimum evidence excerpt and source link, not full document content. Keep issue-index in sync when commitment links change or records are archived. Make index updates retryable; recover inconsistency with the bounded set of explicitly linked records, not an unbounded full-site scan. Never cache an authorization grant as permanent.

## D. Resolver contracts (conceptual; implementation names can differ)

| Resolver | Read/write | Authorized behavior |
|---|---|---|
| `listCommitments` | Read | Only active commitments whose full linked issue set caller can read |
| `getCommitment` | Read | Check access to every linked issue before returning evidence |
| `createCommitment` | Write KVS | Caller is owner, validate selected issues and source URL |
| `updateCommitment` | Write KVS | Owner only; revalidate all linked issues |
| `fulfillCommitment` | Write KVS | Owner only, explicit confirmation |
| `archiveCommitment` | Write KVS | Owner only, explicit confirmation |
| `getIssueCommitments` | Read | Context Jira issue only, linked records only |
| `getImpactGraph` | Read | Explicit links + permission-gated optional Graph nodes |
| `previewMitigation` | Read | Accurate Jira issue draft, no side effect |
| `createMitigation` | Jira/KVS write | Owner, approved UI confirmation, Jira Create Issues authority, duplicate check |

No unlisted public resolver or web endpoint. The three Rovo/MCP tools use the same authorized read services. Do not expose generic CRUD or arbitrary Jira-search tools to the Agent.

## E. Risk data flow

```text
Jira issue updated
  → verify event type and relevant fields
  → ignore self-generated/unlinked/inactive issue
  → fetch current Jira issue(s) from Jira API
  → compute F04 deterministic rules
  → write risk snapshot only if changed (or freshness needs update)
  → UI refresh retrieves authorized current risk
```

Use a stable signature of relevant source fields (issue ID, status/status category, due date, promised date, lifecycle and linked issue set) to prevent duplicate event effects. The trigger does not create Jira tasks or send notifications. Permission revocation and source-read failure must never result in an invented healthy status.

## F. Teamwork Graph boundaries

- Preview capability, GraphQL/Cypher query supported by currently installed schema.
- Access requires object-specific scopes and granted installation/admin permissions.
- Always verify actual source issue/page access before rendering linked context to the user.
- Show **Graph-suggested context** in a clearly differentiated style; never feed suggested links into risk rules.
- If unavailable or blocked, show explicit stored Jira links and a transparent limitation message.
- Forge Rovo agents installed in Jira do **not** automatically get all Confluence content. This app deliberately avoids adding a Confluence-compatible installation in v1.

## G. AI boundaries

An AI explanation input must be a bounded set of authorized, verified facts: commitment title, stored source excerpt, promised date, linked Jira fields, computed reason codes, and safe links. Never send unrelated site data. LLM response is **narrative only**; require a clear distinction between facts and suggestions, reject invented Jira issue keys/dates, and fall back to a deterministic explanation if LLM fails. Treat content supplied by Jira users or documents as untrusted, including prompt-injection attempts.

Do not run an AI call for every Jira update; risk status should remain fully functional with the LLM disabled.

## H. Authorization and security

- Do not build a custom auth flow. Use Atlassian identity.
- UI action: use `api.asUser()` and Jira permissions. No privilege escalation through Forge `asApp`.
- System event: if using `asApp()` to retrieve linked issue changes, never use that access as proof that a particular human is authorized to view the record.
- Reject cross-site source URLs and issue IDs that don't belong to the installation's authorized site.
- Validate server-side request shapes, length limits, URL formats, Jira issue IDs and ownership.
- Escape/render user-provided excerpt as plain text; do not render as trusted HTML.
- Do not write raw source excerpts, personal data or tokens to logs.
- External MCP: administrator must explicitly enable exposure; actions remain user permission constrained.

## I. Test and operational limits

- Prefer bounded (max 10 issue links) resolver requests and short Graph traversals.
- No scheduled polling. Rely on trigger events and on-demand refresh when a detail page opens.
- No retries that duplicate Jira mitigation tasks. The final create action must be explicitly user initiated.
- Use `forge lint`, TypeScript checks, Vitest, and a real Jira dev site for acceptance.
- Do not claim preview Graph/Rovo MCP functionality is available until tested on the judge-installable production app.

## J. Official API references

- Forge: https://developer.atlassian.com/platform/forge/
- Jira events: https://developer.atlassian.com/platform/forge/events-reference/jira/
- Jira issue panel: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/
- Graph API: https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/
- Graph scopes: https://developer.atlassian.com/platform/teamwork-graph/scopes/
- Rovo Skill: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill/
- Rovo MCP: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/
- Forge LLMs: https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api-reference/
