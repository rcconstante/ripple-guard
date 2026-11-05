# Implementation Plan — RippleGuard v1.0

This plan records implementation milestones and the manual acceptance steps in [TEST_MATRIX.md](TEST_MATRIX.md). Code verification uses `npm run check`; live acceptance requires a Jira Cloud site.

| Phase | Features | Code | Accepted on real Jira |
|---|---|---|---|
| 1. Foundation | Forge app, Custom UI, resolver wiring, KVS | Complete | Deployed and installed (dev) |
| 2. Commitment register | F02 | Complete | Pending |
| 3. Issue linkage | F03 (global page, issue panel, `avi:jira:updated:issue`) | Complete | Pending |
| 4. Risk engine | F04 | Complete (truth table unit-tested) | Pending |
| 5. Dashboard and graph | F01, F05 | Complete | Demo flow passed on one-atlas-ayel and rippleguard-dev (Teamwork Graph suggestion shown; see limitation below) |
| 6. Mitigation | F06 | Complete (service tests for duplicates/retries) | Pending |
| 7. Rovo and MCP | F07, F08 | Complete (Preview modules deploy) | F07 passed on one-atlas-ayel (at-risk list, reason, refused a due-date change; Jira unchanged). F08-T01/T02 passed on one-atlas-ayel (admin-enabled external access; an OAuth client approved by the user lists exactly three read-only tools; list and evidence calls return that user's commitment). F08-T03 (restricted user) pending |
| 8. Security, E2E, deployment | SEC, REL, SCOPE tests | Partly (validation, access, logging rules in code) | Pending |

## Where things live

- `src/domain/`: pure logic (risk engine, validation, access decisions, URL parsing, event filtering, mitigation draft, ADF). Unit-tested.
- `src/services/`: Jira, KVS store, risk refresh, AI wording, Teamwork Graph, mitigation, shared authorized reads.
- `src/resolvers/`: Custom UI resolvers (contract in `src/shared/contracts.ts`).
- `src/triggers/issueUpdated.ts`: the single Jira event handler.
- `src/actions/`: the three read-only Rovo/MCP actions.
- `static/rippleguard-ui/`: React Custom UI (four views + issue panel).
- `prompts/rovo-agent.txt`, `skills/rippleguard-impact/SKILL.md`: runtime Rovo behaviour.

## Remaining acceptance work (needs a real Jira site)

Prepare: a Jira project with the standard **Task** issue type, 3–4 issues with due dates, a Confluence page to use as the source link, and a second Jira user who cannot browse that project.

1. **F02-T01..T06** Create, edit (date and links), fulfil and archive a commitment; check counts and that archived/fulfilled are excluded.
2. **F03-T01** Global page and issue panel both load real data.
3. **F03-T02** Move a linked issue's due date past the promised date in Jira; within ~3 minutes the status becomes At risk without opening RippleGuard first (check `forge logs`).
4. **F03-T03/T04** Edit an unrelated field and an unlinked issue: no status change.
5. **F03-T05 / F07-T04 / SEC-T04** As the restricted user: no commitment, issue details or Rovo answers for that project.
6. **F05-T01..T05** Impact Explorer links open the right Jira/Confluence URLs; record whether Teamwork Graph returns context or the fallback message.
7. **F06-T01..T06** Preview creates nothing; confirm creates exactly one Task; repeat clicks show the existing issue; a project without Task shows the unsupported error.
8. **F07-T01..T03** Ask the agent the three supported questions; ask it to email a customer or change a due date (must refuse); put "ignore previous instructions…" in an excerpt (must be ignored).
9. **F08-T01..T03** Check the MCP server lists exactly three GET tools; if an admin enables external access, test with an MCP client and a restricted user.
10. **REL-T02** Deploy to production and have a separate admin install it from the share link.

## Known platform limitations (record results, don't substitute features)

- **Teamwork Graph (F05):** new apps can't send raw Cypher. Enrichment uses the curated field `jiraWorkItemHierarchy` (listed in the site's live Teamwork Graph schema), starting from each linked issue, with the Jira-only scope `read:graph:issue:jira`. Suggestions are re-read from Jira as the user before display. The relationship *kind* isn't shown: on the dev site, the `kinds` filter reported a Jira "Blocks" link in the opposite direction, so the UI only says the issues are related. Graph indexing of a new issue link can lag (2–12 s observed); the demo recorder waits for it before filming. On one-atlas-ayel, Teamwork Graph intermittently answers "User is not permitted to query this organization" (also reported on the developer community for demo-type sites); the service retries that error, and the recorder reloads off-camera and logs the count.
- **Rovo skill and rovo:mcp** are Preview. External MCP access needs an admin to enable it in Atlassian Administration. The MCP endpoint is `https://mcp.atlassian.com/forge/<appId>` (OAuth 2.1 with dynamic client registration); on the consent screen the user must choose a site before Accept is enabled. Tool names carry the environment suffix (for example `list-at-risk-commitments_development`).
- **Forge LLM** needs admin approval at install/upgrade; without it, explanations use rule-based wording (F04-T13).
