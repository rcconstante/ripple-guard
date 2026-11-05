import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter/wght.css";
import "lenis/dist/lenis.css";
import "./globals.css";
import { SmoothScroll } from "./smooth-scroll";

const description = "See which customer promises are at risk when Jira work changes. Watch the RippleGuard demo from Atlassian Codegeist 2026.";

export const metadata: Metadata = {
  title: "RippleGuard | Catch delivery risk in Jira",
  description,
  applicationName: "RippleGuard",
  icons: { icon: "/rippleguard-mark.png" },
  openGraph: {
    title: "RippleGuard | Catch delivery risk in Jira",
    description,
    type: "website",
  },
  twitter: { card: "summary", title: "RippleGuard | Catch delivery risk in Jira", description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
