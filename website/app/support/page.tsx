import type { Metadata } from "next";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Support | RippleGuard",
  description: "Get RippleGuard installation help or contact the maintainer privately about privacy and security.",
};

export default function SupportPage() {
  return (
    <LegalLayout title="How can we help?">
      <p>RippleGuard is maintained by Richmond Constante. Contact us for installation questions, bug reports, or requests concerning your data.</p>
      <h2>Private support, privacy, and security</h2>
      <p>Email <a href="mailto:r.constante.dev@gmail.com">r.constante.dev@gmail.com</a>. Include your Atlassian site URL, a short description, and relevant commitment or issue identifiers. For privacy requests, we will verify your identity and coordinate with your site administrator.</p>
      <p>Do not send passwords, API tokens, verification codes, or unnecessary customer information. Send security reports and personal-data requests by email, rather than posting them publicly.</p>
      <h2>General questions and bugs</h2>
      <p>Read the <a href="https://github.com/rcconstante/ripple-guard#readme">installation and judge walkthrough</a>, or <a href="https://github.com/rcconstante/ripple-guard/issues">open a GitHub issue</a> for a non-sensitive problem. GitHub issues are public. Remove private information from screenshots and logs before posting.</p>
      <h2>Before reporting an installation problem</h2>
      <p>Ask your Jira site administrator to confirm the app is installed and its requested permissions are approved. Confirm you can browse every linked issue. Rovo and MCP additionally require the corresponding site access and administrator configuration.</p>
      <p>This evaluation release has no guaranteed support response time.</p>
    </LegalLayout>
  );
}
