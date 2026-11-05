import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="shell nav">
          <Link className="brand" href="/" aria-label="RippleGuard home">
            <Image src="/rippleguard-mark.png" alt="" width={32} height={28} unoptimized />
            <span>RippleGuard</span>
          </Link>
          <Link className="button button-small button-quiet" href="/">Back to home</Link>
        </div>
      </header>
      <main id="main" className="shell legal-page">
        <p className="kicker">RippleGuard</p>
        <h1>{title}</h1>
        <p className="legal-date">Effective November 5, 2026</p>
        <article className="legal-content">{children}</article>
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <p>RippleGuard · Richmond Constante</p>
          <nav aria-label="Footer navigation">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
