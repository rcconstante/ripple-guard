# Acceptance Test Matrix — RippleGuard v1.0

Every test is mandatory unless marked `Preview platform blocked` after a genuine access/permission test. A blocked preview capability is **not** a passing implementation or a qualifying bonus demo. Real Jira tests must not use fake resolver responses. Use Vitest for pure logic, service-level tests for validation/permissions, and a test Jira tenant for E2E.

## Domain and registration

- **F02-T01** Create commitment with all required fields, same-site source URL, and 1 readable issue → saved active and owner set to caller.
- **F02-T02** Reject missing title/date/customer/source/excerpt or zero linked issues; reject >10 issues, duplicates, invalid dates, invalid/mismatched-site URLs, and oversized content.
- **F02-T03** Deny a user lacking access to **any** linked issue; deny owner actions from a non-owner; ensure read-only viewers can't change data.
- **F02-T04** Editing promised date or linked issue set triggers risk recalculation; issue-index is updated and stale links removed.
- **F02-T05** Mark fulfilled manually and confirm excluded from active counts; Jira Done alone does not fulfill.
- **F02-T06** Archive explicitly and confirm it is excluded from dashboard and trigger processing; no restore/delete UI appears.

## Risk engine truth table

Assume lifecycle `active`, todayUTC `2026-11-04`, and readable issues unless noted.

| Test | Promised date | Linked issue state | Expected status / reason |
|---|---|---|---|
| F04-T01 | 2026-11-30 | Due 2026-11-28, In Progress | On track |
| F04-T02 | 2026-11-30 | Due 2026-12-10 | At risk / `ISSUE_DUE_AFTER_PROMISE` |
| F04-T03 | 2026-11-03 | Due 2026-11-02 | Overdue / `PROMISE_DATE_PASSED` |
| F04-T04 | 2026-11-04 | Due 2026-11-04 | On track; due today is not overdue |
| F04-T05 | 2026-11-30 | Explicit status `Blocked`, due 2026-11-25 | At risk / `EXPLICIT_BLOCKED_STATUS` |
| F04-T06 | 2026-11-30 | Missing due date | Needs review / `MISSING_ISSUE_DUE_DATE` |
| F04-T07 | 2026-11-30 | All issues Done, no owner confirmation | Needs review / `WORK_DONE_AWAITING_CONFIRMATION` |
| F04-T08 | 2026-11-03 | Issue due 2026-12-10 | Overdue wins due to precedence |
| F04-T09 | 2026-11-30 | Jira inaccessible/permission lost | Needs review or stale/denied; NEVER On track |
| F04-T10 | 2026-11-30 | Issue due equal promised date | On track |
| F04-T11 | Any | lifecycle fulfilled/archived | Excluded from active risk status |

- **F04-T12** Test day-only comparisons and deterministic UTC date boundary; no locale-created off-by-one date.
- **F04-T13** LLM disabled/failure does not change risk status and factual reason codes.
- **F04-T14** Recalculation from the same relevant fields yields the same state; no duplicate records.

## Jira and dashboard

- **F03-T01** Open global page and Jira issue panel in an installed development app; both load real data.
- **F03-T02** Issue update from Jira due date before→after promised date changes status (end-to-end real event test).
- **F03-T03** Irrelevant Jira issue update and unlinked issue update do not change commitment status.
- **F03-T04** Out-of-order/duplicate/self-generated events don't cause a false status or task creation.
- **F03-T05** Without Jira Browse permission, user cannot view issue details or related commitment evidence.
- **F01-T01** Counts match authorized active risk records, including filter and promised-date sort.
- **F01-T02** Detail navigation, empty state, loading, network failure, and permission-denied state render correctly.

## Impact graph and optional context

- **F05-T01** Explicitly linked records appear as `Linked by user` and open correct Jira/site URLs.
- **F05-T02** Graph-suggested nodes are visually labeled and never influence risk classification or auto-link to commitment.
- **F05-T03** Graph permission denied/unavailable/empty → user sees explicit links and correct fallback message.
- **F05-T04** Unauthorized/mismatched-site Graph source is filtered out; no private excerpt exposed.
- **F05-T05** Verify a live, supported Teamwork Graph query and its declared object-specific scopes before claiming the Graph bonus.

## Mitigation

- **F06-T01** At risk/Overdue commitment shows reviewable Jira Task preview, sourced evidence links and reason codes.
- **F06-T02** No Jira issue created on clicking the initial button or merely previewing; only final confirmation creates.
- **F06-T03** Creation runs using current user's Jira permission; disallowed Jira Create Issues returns failure without false success.
- **F06-T04** One successful mitigation issue per commitment; repeat clicks show the existing issue, not a duplicate.
- **F06-T05** On track/Needs review/Fulfilled/Archived hide the create action.
- **F06-T06** Unsupported Jira Task type and API failure display explicit errors; no silent alternative issue type.

## Rovo and MCP

- **F07-T01** Agent answers list/why/impact questions using exact permitted actions, with actual source links and dates.
- **F07-T02** Agent refuses requests to email a customer, change Jira due date, create issue, manage billing, or perform unrelated work.
- **F07-T03** Prompt injection inside stored evidence is ignored; unverified fields are labeled as such.
- **F07-T04** A user without Jira visibility cannot obtain restricted commitment details through Agent actions.
- **F08-T01** `rovo:mcp` exposes exactly three **GET** tools; no mutating tool appears.
- **F08-T02** External tool access is admin-enabled and uses the invoking user's permitted context, not blanket app privileges.
- **F08-T03** MCP access with insufficient permission fails securely; no unapproved customer information is returned.
- **F07/F08-T04** If Preview features are unavailable, record the exact limitation without inventing a substitute service.

## Security, usability, deployment and scope

- **SEC-T01** Server-side input validation, read/write authorization, installation isolation and source URL validation pass.
- **SEC-T02** No raw credentials or excerpt/prompt logging; escaped/plain-text excerpt rendering; no unexpected external network requests.
- **SEC-T03** Keyboard navigation and labelled controls in four views and issue panel work.
- **SEC-T04** Test at least one no-data installation, a normal installation, and a permission-constrained account.
- **REL-T01** Typecheck + unit tests + `forge lint` pass; build loads on actual Jira Cloud site.
- **REL-T02** Production Forge installation link works for a separate admin, and judge instructions reproduce the core scenario.
- **SCOPE-T01** Exactly four app views + one issue panel; no settings/auth/billing/chat/reporting/admin route.
- **SCOPE-T02** Approved modules/permissions/actions only; no new integration or external database/service.
- **SCOPE-T03** Manual UI creates Jira issues only after explicit confirmation; system event and AI actions never create or modify Jira work.

## Release gate

Do not call the project **complete** unless every functional mandatory test passes. Preview-blocked tests must be plainly marked, and bonus prize claims requiring them must not be made without proof.
