# RippleGuard v1.0 — FEATURE SCOPE (AUTHORITATIVE)

**FROZEN. This is the exhaustive product contract.** Only F01–F08 below may be implemented. Every observable interface, command, trigger, API call, background action, or persisted record must directly serve one of these features. Internal technical necessities are allowed but must not create additional user-facing capability. If requirements appear incomplete, implement the smallest safe behavior and surface the ambiguity; do not invent a feature.

## A. Intended user and exact promise

Intended user: a Jira user responsible for tracking a documented customer/partner delivery commitment. A commitment refers to one or more existing Jira work items. The product calculates whether known delivery dates conflict with the written promised date, shows evidence, and supports one reviewed mitigation Jira issue.

Single supported flow:
1. User opens **Commitments** and records a customer promise.
2. User provides a source link and a short source excerpt, chooses one or more existing Jira issues, and saves.
3. App retrieves the linked issues and computes the initial risk.
4. When any linked issue changes, a Jira event triggers re-evaluation.
5. Dashboard, detail view and issue panel show the consistent current status.
6. Impact Explorer displays the authoritative links and any separately labeled optional Teamwork Graph context.
7. User reviews a suggested mitigation and may explicitly confirm creation of **one** Jira issue.
8. A read-only Rovo agent and three MCP tools can query the same authorized evidence and risk results.

## B. Precisely permitted views

### F01 — Impact Dashboard

**Global page view:** `Impact Dashboard`.

Must show: counts of **On track**, **At risk**, **Overdue**, and **Needs review** commitments; a list with title, customer label, promised date, risk status, affected Jira issues; filter by one of those four statuses; sort by promised date ascending; click through to Commitment Detail.

Counts are calculated from stored **active** commitments only; fulfilled/archived are excluded. If the current user cannot see an issue linked to a commitment, do not expose that commitment. Do not show unverified revenue estimates, invented confidence scores, charts, analytics trends, KPIs beyond the four counts, or predictive forecasts. Show loading/empty/error states.

### F02 — Commitment Register

**Global page views:** `Commitments` list and `Commitment Detail`.

**Allowed operations:** create, view, edit, mark fulfilled (manual), archive, and list commitments. No hard delete, bulk import, bulk edit, duplication, collaborator roles, notes, file upload, OCR, or automatic document extraction.

**Fields (no extras):**

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | UUID | Generated | Immutable |
| `installationId` | String | Internal | Scopes all persisted records |
| `title` | String | Yes | 5–140 characters |
| `customerLabel` | String | Yes | 1–120 characters; plain label, not a CRM record |
| `ownerAccountId` | String | Generated | Current Jira user; immutable in v1 |
| `promisedDate` | Date-only string | Yes | `YYYY-MM-DD`, date-only semantics |
| `sourceUrl` | URL | Yes | HTTPS URL belonging to current Atlassian Cloud site; no content scraping |
| `evidenceExcerpt` | String | Yes | 10–1000 characters, manually entered by the user |
| `linkedIssueIds` | Unique string[] | Yes | Between 1 and 10 existing, readable Jira issues |
| `lifecycle` | Enum | Generated | `active`, `fulfilled`, `archived` |
| `createdAt` / `updatedAt` | ISO timestamp | Generated | Audit metadata only, not user-facing activity feed |
| `fulfilledAt` | ISO timestamp or null | Generated | Set only by explicit owner action |

**Authorization:** Creating user becomes owner. All linked issues must be readable by caller. Owner may edit/fulfill/archive while still authorized to read all linked issues. Other viewers may only read if they can read **every** linked issue. If visibility cannot be verified, deny the read. No per-team permissions system.

**Record behavior:**
- Editing title, date, source, excerpt, or linked issues triggers risk recalculation.
- Changing linked issues revalidates access for the full set.
- Marking fulfilled is a manual statement by the owner; `Done` Jira issue status never auto-fulfills.
- Archiving excludes the record from active counts and trigger processing. No archive restoration in v1.
- Display source URL as a user-clickable Atlassian link; never fetch arbitrary URL content.
- The source excerpt is **user attested** evidence, not independently verified; label it `Recorded excerpt`.

### F03 — Jira Integration

**Forge modules:** one `jira:globalPage` and one `jira:issuePanel` using Forge Custom UI; subscribe to the single `avi:jira:updated:issue` event. No custom field creation, workflow changes, comment bot, Jira automation rules, webhook receiver, or scheduled scans.

**Issue linking:** search by Jira issue key or URL through Jira API, validate existence/read permission, choose up to 10. Internally store issue IDs and show current keys/titles through a fresh Jira read. Do not auto-link issues based on semantic similarity.

**Issue panel:** given the opened issue, show only commitments explicitly linked to that issue and readable by the current user: title, promise date, risk badge, and detail link. Do not create/edit commitments from the issue panel.

**Event behavior:** On update, ignore if the issue is not linked to active commitments. Fetch current issue state to avoid stale event assumptions. Recalculate relevant records only for due date, status, or other explicitly checked attributes. Handle retries, self-generated changes, and out-of-order delivery without duplicate mitigation records. Never mutate a Jira issue from this trigger.

### F04 — Deterministic Risk Engine

The risk engine is the **only** authority for risk state. LLM outputs must never modify the risk state.

**Scope:** active commitments with at least one explicit issue link. Calculate risk from the stored promised date and the current state of linked Jira issues.

**UTC date rule:** Use `todayUTC = new Date().toISOString().slice(0,10)` for comparisons; show dates as dates (not local timestamp conversions). A commitment due *today* is not overdue.

**Evaluation precedence (first match wins):**

1. `overdue`: `todayUTC > promisedDate` and lifecycle is still `active`.
2. `at_risk`: any linked issue has a valid `duedate > promisedDate` OR an explicitly named Jira issue status equal to `Blocked` (case-insensitive exact text comparison).
3. `needs_review`: any linked issue is inaccessible, has no due date, or all linked issues are in Jira's Done status category while commitment remains manually unfulfilled.
4. `on_track`: all linked issue due dates are on/before promised date, none explicitly Blocked, all readable, and above rules do not apply.

If issue data is temporarily unavailable, retain the last safely stored risk snapshot but clearly label it **Stale — could not verify current Jira data**; don't silently show it as current. If a record is archived/fulfilled, it is excluded from active evaluation and shown under its lifecycle state only.

**Reason codes:** `PROMISE_DATE_PASSED`, `ISSUE_DUE_AFTER_PROMISE`, `EXPLICIT_BLOCKED_STATUS`, `MISSING_ISSUE_DUE_DATE`, `ISSUE_NOT_READABLE`, `WORK_DONE_AWAITING_CONFIRMATION`. Compute every applicable reason within the winning status class and persist the matching source issue IDs and observed dates. Never infer an undocumented dependency or “likelihood of delay.”

The UI may show a human-readable grounded explanation generated from reason codes, but must always show the raw factual evidence too.

### F05 — Evidence & Impact Graph

**Global page view:** `Impact Explorer`. Inputs: an existing commitment ID selected from its detail. The graph shows a commitment node, linked Jira issue nodes and edges explicitly named `Linked by user` with clickable Jira/source links.

**Optional enrichment:** When installed, permitted, and supported, query Teamwork Graph **read-only** to show related supported Jira issues or Confluence documents as additional `Graph-suggested context` nodes and edges. A graph-suggested node must never silently become an authoritative commitment link or trigger a risk. The user can open the actual source link but cannot edit graph relationships in v1.

- Use the current supported GraphQL/Cypher fields, scopes, and traversal patterns; never hardcode undocumented relationship names.
- If Graph access is absent, denied, or returns no supported relationships, show authoritative explicit links and the message `Additional Teamwork Graph context unavailable`.
- Never claim a graph-suggested relationship proves a commitment was made.
- No graph editing, cross-tenant search, organization-wide search portal, graph exports, or infinite exploration.

### F06 — Mitigation workflow

In Commitment Detail, display `Create mitigation Jira issue` only when lifecycle is `active` and risk status is `at_risk` or `overdue`. The button opens a review modal showing target project (fixed to the first linked Jira issue's project), summary, and description prefilled with factual risk reason codes, issue links and evidence link. Owner may edit the summary/description fields before confirming. The user must click **Confirm create issue** to initiate a Jira REST issue create call **as that user**, respecting Jira project permissions.

- Create one standard Jira **Task** issue per commitment in v1; if one already exists, show its link instead of permitting another.
- If Task issue type isn't available in that project, show a clear unsupported-project error; do not silently choose a different issue type.
- Generate only factually supported description text, and label possible next steps as suggestions.
- On failure, show error and no false success; on success persist `MitigationReference` (commitment ID, Jira issue ID, creator, time).
- Support retry safely by checking an existing reference before creating; if creation succeeded but storing the reference failed, do not claim automatic duplicate-free recovery. Provide a recovery notice requiring user review and manual reconciliation. Do not add an automatic reconciliation service.
- No notification, emailing, automatic Jira issue edits, scheduling, bulk issue creation, or customer contact.

### F07 — Rovo Agent

Declare **exactly one** `rovo:agent` named `RippleGuard Impact Agent`, its task-specific `rovo:skill`, and the three read-only actions defined below. Its permanent behavior is in `prompts/rovo-agent.txt` and procedure in `skills/rippleguard-impact/SKILL.md`.

Supported question classes ONLY:

- “Which of my accessible commitments are at risk?”
- “Why is commitment X marked at risk or overdue?”
- “What confirmed linked work and permitted graph context might be affected by issue X?”

Rovo outputs must include issue keys, dates, reason codes translated into concise prose, and source links. If evidence is incomplete, say so. It may **suggest** using the mitigation form but cannot create issues, change dates, message anyone, update commitment lifecycle, or invoke an unlisted action. Respect the same user access policy as the Custom UI.

Exactly three actions (read-only):

1. `list-at-risk-commitments`
2. `get-commitment-evidence`
3. `preview-issue-impact`

### F08 — MCP exposure

Declare exactly one Forge `rovo:mcp` module exposing **only** the same three read-only actions used by F07. Never expose `create`, `update`, `delete`, `trigger` or other mutating actions. Tools must enforce the same Jira visibility and tenant checks as the UI; MCP client authorization must not broaden privileges. External MCP exposure requires administrator opt-in in Atlassian Administration. If the Preview functionality is unavailable, record that limitation rather than substituting an external MCP server.

## C. Explicit exclusions, even if a tool suggests them

- No generic knowledge assistant, universal search, AI-generated customer replies, email/Slack messages, push notifications, webhooks to external services, chat history, reporting exports, RAG index, vector database, autonomous agents or agent-to-agent delegation.
- No CRM integration, contracts database, financial valuation, customer revenue calculation, marketing site, account management, payment gateway, subscription plans, SSO, custom auth, multiple organization support or mobile app.
- No Confluence app module or broad document ingestion. A saved Confluence source URL and optional permission-gated graph reference is enough for v1.
- No marketplace monetization feature; Marketplace submission is a packaging/distribution activity, not an application feature.

## D. Exact UI text/status vocabulary

Lifecycle: `Active`, `Fulfilled`, `Archived`.
Risk states: `On track`, `At risk`, `Overdue`, `Needs review`.
Evidence labels: `Recorded excerpt`, `Linked by user`, `Graph-suggested context`, `Stale — could not verify current Jira data`.
No speculative numeric risk scores, percentages of completion, severity classifications, or financial estimates.

## E. Acceptance handshake

A feature is complete only when the stated behavior runs against actual Atlassian data, the tests in `docs/TEST_MATRIX.md` pass, and the implementation has not added any excluded UI, routes, modules, API endpoints, persistence, automatic side effects, or permissions. A sample-only screen, a synthetic event masquerading as real data, or a mocked production resolver does not count.
