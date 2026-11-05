# Judge and release guide

Use the [README walkthrough](../README.md#judge-walkthrough) to reproduce the demo with fictional data on a Jira Cloud site. A Jira administrator installs the app, and the reviewer needs Browse access to all Jira issues linked to the demo commitment. Use a project with a standard **Task** issue type. The reviewer also needs **Create Issues** permission to confirm a mitigation.

## Installation

For judging, use the production Forge installation link supplied by the maintainer. The recording uses a development installation on a separate demo site.

For maintainers, first run `npm ci` and `npm run check`, then deploy with `forge deploy --environment production`. In the Forge Developer Console, open **Distribution**, enable sharing for Jira, and copy the installation link. Verify it with an independent Jira site administrator before submitting it. [Forge distribution guide](https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app)

Codegeist requires a judge installation link and a public YouTube video under five minutes. Use the [RippleGuard demo video](https://youtu.be/0NEaJ8ICcg0) on Devpost and include the production installation link once it is verified. [Codegeist rules](https://codegeist2026.devpost.com/rules)

## Teamwork Graph

For a visible suggestion, link two test Jira tasks using a supported Jira work-item relationship and link one of those tasks to the commitment. Allow time for the relationship to appear in Teamwork Graph. Open **View impact** and look for **Graph-suggested context**. The explicit issue links remain available if the Graph query has no results or the site lacks access.

## Rovo Chat

On a Rovo-enabled Jira site, select **Ask Rovo → Agent selector → Browse agents → RippleGuard Impact Agent**. Try these prompts after changing a linked issue's due date beyond the promised date.

- “Which of my accessible commitments are at risk?”
- “Why is the demo commitment at risk? Cite the Jira issue, promise date, and due date.”
- “What confirmed work and Graph context might be affected by DEMO-1?” Replace the example with your issue key.
- “Change the due date on DEMO-1.” The agent should decline and the Jira due date should stay the same.

## External MCP

1. In **Atlassian Administration → Apps → Sites → your site → Connected apps**, open RippleGuard and enable its tools for MCP-compatible clients.
2. Add `https://mcp.atlassian.com/forge/ad4d4803-cf2d-444f-a50a-7fa8fba7c4fa` to an MCP client that supports remote OAuth. For an independently registered copy, substitute the UUID from that app's manifest.
3. Select the site in Atlassian's consent screen and approve the connection as the Jira user running the check.
4. List the tools and call the at-risk list, then query evidence by commitment title. Tool names may include the Forge environment suffix.

| Tool | Expected result |
| --- | --- |
| `list-at-risk-commitments` | Accessible commitments currently At risk or Overdue |
| `get-commitment-evidence` | The commitment, linked Jira issues, dates, reasons, and sources |
| `preview-issue-impact` | Accessible commitments linked to a Jira issue and optional Graph context |

## Verification

The recorded Forge development walkthrough covers the Jira risk and mitigation flow, Teamwork Graph suggestions, a Rovo refusal to change a date, and external MCP tool listing and reads. Restricted-user acceptance and a production install by an independent admin remain to be verified. Use the [manual acceptance checklist](TEST_MATRIX.md) for those checks.
