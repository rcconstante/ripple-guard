import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service | RippleGuard",
  description: "Terms for using the RippleGuard Forge app, website, and hackathon evaluation release.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of service">
      <p>These terms govern your use of RippleGuard, maintained by Richmond Constante, including its Forge app and public website. By installing or using the service, you agree to these terms. If you act for an organization, you must have authority to do so.</p>

      <h2>Evaluation release</h2>
      <p>RippleGuard is provided as a free hackathon evaluation release. It helps teams track documented commitments and identify risks in linked Jira work. Features, availability, and platform dependencies may change. No paid subscription or service-level agreement is included.</p>

      <h2>Installation and access</h2>
      <p>An authorized Atlassian site administrator must install the app and approve its permissions. Users need appropriate Jira access. Rovo, Teamwork Graph, and MCP availability depend on your site’s entitlements, permissions, and administrator settings. Your use of Atlassian and any connected third-party service remains subject to its separate terms.</p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Enter accurate information and only content you are authorized to process.</li>
        <li>Follow your organization’s security and privacy requirements and applicable law.</li>
        <li>Do not submit credentials or sensitive personal data, bypass permissions, abuse APIs, or interfere with other users or installations.</li>
        <li>Review risk evidence and proposed mitigation content before relying on it or confirming an action.</li>
      </ul>

      <h2>Risk indicators and AI output</h2>
      <p>Risk indicators reflect the configured rules and available linked Jira data. They do not guarantee that a delivery will succeed or identify every dependency or risk. Recorded excerpts are user-provided evidence and are not independently verified. Teamwork Graph suggestions are additional context and do not automatically become commitment links.</p>
      <p>AI explanations and Rovo answers may be incomplete or inaccurate. You remain responsible for decisions, customer communications, and checking the underlying facts. The Rovo and MCP tools are read-only. Creating a mitigation Jira task requires explicit confirmation in the app. If an attempt has an uncertain result, check Jira before retrying.</p>

      <h2>Your content and privacy</h2>
      <p>You retain your rights to the content you provide. You authorize the processing needed to operate the app, including storing records in Forge and providing the integrations you choose to use. Our <Link href="/privacy">privacy policy</Link> explains data handling and how to request access, correction, or deletion.</p>

      <h2>Availability and ending use</h2>
      <p>You may stop using the app at any time, and your administrator may uninstall it. Uninstalling does not remove Jira tasks already created. Forge-hosted data follows Atlassian’s storage lifecycle. We may change or discontinue the evaluation service, or restrict use that threatens security or violates these terms. We will provide notice of material changes where reasonably practicable.</p>

      <h2>Warranties and liability</h2>
      <p>To the extent permitted by applicable law, the service is provided “as is” and “as available,” without warranties of uninterrupted availability, accuracy, fitness for a particular purpose, or guaranteed outcomes. To the extent permitted by law, the maintainer is not liable for indirect or consequential losses, lost profits, or loss of data arising from use of the service. These terms do not exclude rights or liabilities that cannot legally be excluded.</p>

      <h2>Project materials and third-party rights</h2>
      <p>Public access to the source repository does not by itself grant a license to reuse all project code or branding. Any reuse is governed by the applicable repository license and third-party licenses. Atlassian, Jira, Rovo, and other third-party names belong to their respective owners. RippleGuard is an independently developed project.</p>

      <h2>Changes and contact</h2>
      <p>Updated terms will be published here with a revised effective date. For questions, security reports, or support, visit <Link href="/support">our support page</Link>.</p>
    </LegalLayout>
  );
}
