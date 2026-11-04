# Demo and Submission — RippleGuard v1.0 (draft)

Status: **draft**. Record final footage only after the full rehearsal in `docs/IMPLEMENTATION_PLAN.md` passes on a real Jira site. Verify the Devpost deadline before submitting.

## 1. Production deployment

```bash
npm install
npm run check                       # typecheck, lint (incl. forge lint), tests, build
forge deploy -e production
forge install -e production --product jira --site <judge-or-test-site>.atlassian.net
```

Share the production installation link from the Developer Console (Distribution) so a separate admin can install it (REL-T02).

## 2. Admin steps after install

1. Approve the app's permissions, including Forge LLM (used only for explanation wording).
2. Teamwork Graph scopes require an organization admin. If Graph context isn't available, the Impact Explorer shows "Additional Teamwork Graph context unavailable" (expected fallback).
3. Optional, for external MCP clients: Atlassian Administration → Apps → Sites → your site → Connected apps → enable external access for RippleGuard. Rovo Studio access needs no extra step.

## 3. Judge test setup

1. In a Jira project that has the **Task** issue type, create two issues with due dates before 30 days from today, for example `DEMO-1` (due in 10 days) and `DEMO-2` (due in 20 days).
2. Have a Confluence page (or any page on the same site) that records the customer promise; copy its URL.
3. Open **Apps → RippleGuard** in Jira.

## 4. Demo script (target about 3 minutes, under 5)

1. **Record commitment** (Commitments → New commitment): title, customer label, promised date 25 days out, the source URL, a short excerpt, link `DEMO-1` and `DEMO-2`. Save → status **On track**.
2. **Move a Jira due date**: open `DEMO-2` in Jira and set its due date after the promised date. Wait for the event (up to ~3 minutes) or reopen the commitment.
3. **Show risk and evidence**: Dashboard shows **At risk**; Commitment Detail shows reason `ISSUE_DUE_AFTER_PROMISE`, the issue key and dates, the recorded excerpt, and the explanation. The issue panel on `DEMO-2` lists the commitment.
4. **Inspect the graph**: View impact → commitment and issues joined by "Linked by user", plus Graph-suggested context or the fallback message.
5. **Confirm one mitigation**: Create mitigation Jira issue → review the draft → Confirm create issue → link to the new Task. Click again: the existing issue is shown, not a duplicate.
6. **Read-only Rovo**: ask the RippleGuard Impact Agent "Which of my accessible commitments are at risk?" and "Why is <title> marked at risk?". Then ask it to change a due date: it refuses.

## 5. Devpost description outline

- Category: Apps for Business Teams.
- Problem: delivery promises live in documents while delivery dates move in Jira.
- What it does: F01–F08 in one paragraph each, using the exact status vocabulary.
- How it's built: Forge (Custom UI, resolvers, KVS, one Jira trigger), deterministic risk engine, Forge LLM for wording only, Teamwork Graph (optional, read-only), one Rovo agent + skill, `rovo:mcp` with three read-only tools.
- Trust and safety: every read re-checks Jira permissions as the user; AI never decides status; one user-confirmed Jira write.
- Limitations: state any Preview features that were not verified on the judge-installable app. Don't claim bonus features without proof.
