import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy | RippleGuard",
  description: "How RippleGuard handles commitment records, Atlassian account identifiers, Jira data, and AI features.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>This policy covers the RippleGuard Atlassian Forge app and its public presentation website. RippleGuard is maintained by Richmond Constante. Your organization also controls the Jira site where the app is installed.</p>

      <h2>Information the app handles</h2>
      <ul>
        <li>Commitments you enter, including titles, customer labels, promised dates, source URLs, recorded excerpts, and linked Jira issue identifiers.</li>
        <li>Atlassian account IDs identifying commitment owners and users who confirm mitigation creation, together with installation identifiers and record timestamps.</li>
        <li>Jira issue information needed to evaluate and explain risk, including issue keys, summaries, statuses, and due dates. Stored risk snapshots include relevant issue evidence and cached explanation text.</li>
        <li>Mitigation attempt records and references to Jira tasks created after your confirmation.</li>
        <li>Related Jira issue context returned by Teamwork Graph when that capability is available and permitted.</li>
      </ul>
      <p>Free-text fields may contain personal or confidential information if you enter it. Use only information you are authorized to share. Do not include passwords, tokens, payment information, or sensitive personal data.</p>

      <h2>Why information is used</h2>
      <p>RippleGuard uses this information to track commitments, check linked Jira work, calculate risk using fixed rules, explain the evidence, enforce ownership and access checks, and create a mitigation task when the owner explicitly confirms it. We do not sell app data or use it for advertising.</p>

      <h2>Storage and access</h2>
      <p>App records are stored in Atlassian-hosted Forge Key-Value Store, scoped to the installation. The app has no separate external application database. Reading a commitment requires verified access to all its linked Jira issues. Ownership checks apply to changes and mitigation creation. Authorized app maintainers may access installation data when needed for support, security, or a verified privacy request.</p>

      <h2>AI, Rovo, and MCP</h2>
      <p>RippleGuard uses Atlassian Forge LLM to turn commitment and risk facts into explanation text. The explanation prompt includes the commitment title, promised date, evaluation date, calculated status, and relevant issue keys, due dates, and statuses. The recorded excerpt is not sent to this explanation model. Risk classifications come from application rules. AI wording can be inaccurate and should be checked against the displayed evidence.</p>
      <p>If you use the Rovo agent, accessible commitment evidence is returned to Rovo through read-only actions. If your administrator enables the MCP tools and you authorize an external client, the requested accessible data is returned to that client. That client handles the data under its own privacy terms. Atlassian services and their AI processing are governed by your applicable Atlassian agreements and <a href="https://www.atlassian.com/legal/privacy-policy">Atlassian’s privacy policy</a>.</p>

      <h2>Retention and deletion</h2>
      <p>Commitment records, risk snapshots, and mitigation references persist while the installation remains active unless removed through an authorized support process. Archiving or fulfilling a commitment changes its lifecycle and does not erase the record. There is currently no self-service permanent-delete control.</p>
      <p>For access, correction, or deletion requests, contact us using the private email on the <Link href="/support">support page</Link> and include your site URL and the relevant record identifiers. We verify identity and coordinate with your site administrator before acting. Do not send credentials. Data remaining after uninstall follows <a href="https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/">Atlassian’s Forge storage lifecycle</a>. Jira tasks created by the app remain in Jira and must be managed there.</p>

      <h2>Website and diagnostics</h2>
      <p>The website does not implement visitor accounts, advertising trackers, analytics scripts, or nonessential cookies. Fonts, images, and the playable demo are served from the website. Its hosting provider may process IP addresses, request details, and technical logs to deliver and protect the service. Following GitHub or YouTube links opens services with their own privacy policies.</p>
      <p>The app logs limited diagnostic information such as error types and request failure statuses. It is designed to avoid logging raw prompts, commitment excerpts, or credentials. Support messages are used to handle your request and retained as needed to resolve it and meet applicable obligations.</p>

      <h2>Your choices and policy updates</h2>
      <p>Your site administrator can manage app installation and MCP access. You can choose whether to use Rovo or connect an external MCP client. Depending on applicable law, you may have rights to access, correct, delete, restrict, or object to processing of your personal information. Contact <Link href="/support">support</Link> to make a request or raise a concern. We will update this page and its effective date when our practices change.</p>
    </LegalLayout>
  );
}
