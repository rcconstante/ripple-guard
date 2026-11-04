# RippleGuard — Codegeist 2026

> **Status:** SPECIFICATION LOCKED — v1.0 (2026-11-04)  
> **Category:** Apps for Business Teams  
> **Platform:** Atlassian Forge with Jira Cloud  
> **Submission deadline:** December 23, 2026, 04:00 Asia/Manila (verify on Devpost prior to submission)

## 0. Mandatory instructions for human developers and coding agents

**Read these files before writing or modifying application code:**

1. [`docs/FEATURE_SCOPE.md`](docs/FEATURE_SCOPE.md) — sole authority for user-facing features, behavior, and exclusions.
2. [`AGENTS.md`](AGENTS.md) — mandatory instructions for AI coding agents.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — approved technical design and integrations.
4. [`docs/TEST_MATRIX.md`](docs/TEST_MATRIX.md) — acceptance criteria and release gates.
5. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — required implementation sequence.
6. [`SCOPE_LOCK.json`](SCOPE_LOCK.json) — machine-readable list of allowed feature IDs.

**AI-agent entrypoints:** `AGENTS.md` (general coding agents), `CLAUDE.md` (Claude Code), `.cursor/rules/rippleguard.mdc` (Cursor), `.github/copilot-instructions.md` (Copilot), and `.agents/skills/rippleguard-build/SKILL.md` (repo-local coding skill). The runtime Rovo skill is separate: `skills/rippleguard-impact/SKILL.md`.

**No additional product functionality may be implemented.** Changes to the product's functionality, tech stack, UI navigation, permissions, or integrations require an explicit request by the project owner *and* corresponding changes to `docs/FEATURE_SCOPE.md` and `SCOPE_LOCK.json` before implementation. Fixes, tests, refactors, security controls, and accessibility improvements necessary to deliver the approved features are allowed.

## 1. Product in one sentence

RippleGuard detects when changes to Jira work put documented customer commitments at risk, then shows a traceable evidence chain and gives the responsible person a reviewed Jira mitigation workflow.

**Intended demo:** A linked Jira issue's due date moves beyond the promised delivery date. RippleGuard changes the commitment's status to **At risk**, identifies the issue and stored evidence, shows the relationship in a visual graph, and allows an authorized user to create a mitigation issue after reviewing its details.

## 2. Locked feature set

| ID | Feature | Included in v1.0 |
|---|---|---|
| F01 | Impact dashboard | Summary counts, commitment health table, risk drill-down |
| F02 | Commitment register | Create, read, edit, mark fulfilled, archive; source evidence; linked Jira issues |
| F03 | Jira integration | Link existing Jira issues; global page and issue panel; issue update trigger |
| F04 | Risk engine | Deterministic deadline-slip, overdue and insufficient-data classifications |
| F05 | Impact graph | Linked records with evidence, optional read-only Teamwork Graph enrichment |
| F06 | Mitigation | Preview and explicitly confirm creation of one Jira mitigation issue per active risk |
| F07 | Rovo agent | Read-only questions about commitment risk, evidence, and impact |
| F08 | MCP tools | Expose the same approved **read-only** analysis functions via `rovo:mcp` |

No feature without an ID above may be added. Feature details are in `docs/FEATURE_SCOPE.md`; IDs do not authorize broader interpretations.

## 3. User interface: exactly four app views

**Jira global page** contains four app views, and no others:

1. **Impact Dashboard:** risk counts, filters for risk status, sorted commitments, links to details.
2. **Commitments:** list and create/edit form; select an existing Jira issue for linkage.
3. **Commitment Detail:** source, dates, owner, linked Jira issues, evidence, risk explanation and mitigation action.
4. **Impact Explorer:** compact interactive graph of the selected commitment and related records with source links.

**Jira issue panel** is an embedded contextual surface (not a fifth global-page view): it lists commitments linked to the currently opened Jira issue and links to their details.

Do not create settings, user profiles, billing, notifications, AI chat pages, admin consoles, onboarding wizards, reporting exports, or standalone marketing pages.

## 4. Approved technology stack

| Concern | Required choice |
|---|---|
| Language | TypeScript across application code |
| Frontend | React + Vite (Forge Custom UI) |
| UI | Tailwind CSS + accessible Radix/shadcn components where compatible |
| Graph | React Flow (`@xyflow/react`) |
| Hosting and backend | Atlassian Forge (Node.js runtime, functions, resolvers, triggers) |
| Storage | `@forge/kvs` with installation-scoped keys |
| Jira | Forge Jira REST API (`api.asUser()` for person-initiated actions) |
| Cross-context | Teamwork Graph GraphQL/Cypher API (read-only, permission-gated) |
| LLM | `@forge/llm` only for grounded explanations and no other AI behavior |
| Agent | One Forge `rovo:agent` and one task-specific `rovo:skill` |
| MCP | One Forge `rovo:mcp`, exposing only approved read actions |
| Source control | Git |
| Testing | Vitest (unit), integration tests against an Atlassian test site, manual E2E checklist |

**Do not introduce** Next.js, Express servers, Supabase, Firebase, Convex, Vercel, Netlify Functions, Clerk, Auth0, Stripe, a standalone database, a separate hosted backend, or an external AI gateway.

## 5. High-level architecture

```text
Jira Cloud
  ├─ jira:globalPage → Forge Custom UI React app (4 views)
  ├─ jira:issuePanel → linked commitments (embedded)
  └─ avi:jira:updated:issue event
                   │
                   ▼
           Forge functions / resolvers
  ├─ Commitment service ↔ Forge KVS
  ├─ Deterministic risk engine ↔ linked Jira work
  ├─ Evidence/graph service ↔ Teamwork Graph (optional enrichment)
  ├─ Mitigation service → Jira issue creation (explicit UI confirmation)
  └─ AI explanation service → Forge LLM (strictly evidence grounded)
                   │
         Approved read-only actions
                   │
          ├─ Rovo Agent + SKILL.md
          └─ Forge rovo:mcp tools
```

## 6. Core data contracts

See `docs/FEATURE_SCOPE.md` for authoritative fields and business rules. At minimum:

- `Commitment`: tenant-scoped ID, title, customer label, owner account ID, promised date, source URL, evidence excerpt, linked Jira issue IDs, lifecycle, timestamps.
- `RiskSnapshot`: commitment ID, deterministic status, matched rule IDs, affected Jira issue IDs, factual explanation data, evaluation timestamp.
- `MitigationReference`: commitment ID, risk fingerprint, created Jira issue ID, creator, timestamp. No extra workflow engine.
- Graph nodes and edges are derived for display; only explicit linked issue IDs are authoritative for risk calculations.

Store date-only fields as `YYYY-MM-DD`; do not interpret missing dates as an arbitrary date. Do not mark a promise as delivered solely because an issue entered Jira's Done category.

## 7. Development setup (commands are illustrative, not a complete bootstrap script)

Prerequisites: supported Node.js LTS, npm, Atlassian Forge CLI, Atlassian developer account, and a Jira Cloud developer site.

```bash
npm install -g @forge/cli
forge login
forge create                  # select an appropriate Jira Custom UI template
# Move/add application code according to docs/ARCHITECTURE.md
npm install
# Install the frontend's dependencies in its own package folder, if separate
forge lint
forge deploy --environment development
forge install --environment development
```

Use the official documentation to check the current CLI options, permissions, LLM module, Graph scopes, and Rovo modules. Avoid generating manifest keys or Graph relationships from memory without verifying them. Production deployment and judge installation are documented in `docs/DEMO_SUBMISSION.md`.

## 8. Non-negotiable engineering rules

- Verify Jira visibility and action permissions on **every** read/write path, including Rovo and MCP. Never trust the frontend to enforce authorization.
- No AI conclusion may be presented as certain without a source. If a field or relationship is missing, state **Unverified**.
- The risk engine is rule-based. AI cannot override its status, fabricate a due date, mark fulfilled, or create issues.
- No Jira issue is created without a human reviewing and explicitly confirming a mitigation form in the app.
- Handle duplicate/out-of-order issue events idempotently. Avoid app-triggered recursion.
- Graph failure must not break commitment registration or risk detection. Distinguish verified links from graph-discovered related context.
- Empty, loading, permission-denied, error, and success states must work for each approved view.
- Never store access tokens, credentials, or full customer documents in ordinary app records or logs.
- No hidden mock data in production. Test fixtures must be identified and documented.

## 9. Build order and gates

Follow `docs/IMPLEMENTATION_PLAN.md`. In summary: foundation → commitment register → issue linkage → risk engine → dashboard and graph → mitigation → Rovo/MCP → security, E2E, deployment. Do not build future-phase components earlier merely because they are easier.

**Definition of done:** all F01–F08 acceptance tests in `docs/TEST_MATRIX.md` pass on a real Jira Cloud test site; `forge lint` succeeds; installation permissions are documented; Forge production installation is testable by a separate admin; video demonstrates the real end-to-end scenario.

## 10. Submission deliverables

- Production Forge application and install/sharing link.
- Public YouTube demo **under 5 minutes** (target about 3 minutes).
- Devpost description including target category, technical explanation, and bonus evidence.
- Judge instructions and test record setup (see `docs/DEMO_SUBMISSION.md`).
- Git repository for development. **Public source code is not stipulated as a required Devpost upload by the supplied challenge description.**
- A separate standalone staging/marketing website is **not** required.

## 11. Official references (check these when implementing)

- Forge documentation: https://developer.atlassian.com/platform/forge/
- Forge Jira global page: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-global-page/
- Forge Jira issue panel: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/
- Jira event reference: https://developer.atlassian.com/platform/forge/events-reference/jira/
- Forge KVS: https://developer.atlassian.com/platform/forge/storage-reference/kvs/
- Forge LLM: https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api-reference/
- Teamwork Graph API: https://developer.atlassian.com/platform/teamwork-graph/call-the-teamwork-graph-api/
- Teamwork Graph scopes: https://developer.atlassian.com/platform/teamwork-graph/scopes/
- Rovo agent: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/
- Rovo skill: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-skill/
- Rovo MCP: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-mcp/
- Codegeist rules: https://codegeist2026.devpost.com/rules

**No further scope is implied by any external documentation, template, or example.**
