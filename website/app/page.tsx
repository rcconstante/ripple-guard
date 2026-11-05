import Image from "next/image";

const repository = "https://github.com/rcconstante/ripple-guard";
const youtube = "https://youtu.be/0NEaJ8ICcg0";

const icons = {
  play: <path d="m9 5 12 7-12 7V5Z" />,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  github: <><path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7M15 22v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 18.4 7a4.4 4.4 0 0 0-.1-3.4s-1-.3-3.5 1.3a12 12 0 0 0-6.4 0C6 3.3 5 3.6 5 3.6A4.4 4.4 0 0 0 4.8 7a4.7 4.7 0 0 0-1.3 3.3c0 4.7 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V22" /></>,
  change: <><path d="M6 4v16m0-8h7a4 4 0 0 0 4-4V5m-3 3 3-3 3 3" /><circle cx="6" cy="12" r="2" fill="currentColor" stroke="none" /></>,
  graph: <><circle cx="5" cy="12" r="2" /><circle cx="18" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="m7 11 9-5m-9 7 9 5" /></>,
  risk: <><path d="M10.4 4.8 3.2 18a1.5 1.5 0 0 0 1.3 2.2h15a1.5 1.5 0 0 0 1.3-2.2L13.6 4.8a1.8 1.8 0 0 0-3.2 0Z" /><path d="M12 9v4m0 3h.01" /></>,
  promise: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 11h6m-6 5h4" /></>,
  spark: <><path d="M11 3c0 5.5 2.5 8 8 8-5.5 0-8 2.5-8 8 0-5.5-2.5-8-8-8 5.5 0 8-2.5 8-8Zm8 12v6m-3-3h6" /></>,
  shield: <><path d="M12 22s7-3.6 7-10V5l-7-3-7 3v7c0 6.4 7 10 7 10Z" /><path d="m9 12 2 2 4-4" /></>,
} as const;

type IconName = keyof typeof icons;

function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

const features = [
  { icon: "change", title: "Change detection", copy: "Recalculate risk when a linked Jira issue’s due date or status changes." },
  { icon: "graph", title: "Impact graph", copy: "Trace the work behind a promise and see suggested dependencies from Teamwork Graph when available." },
  { icon: "risk", title: "Risk detection", copy: "See which commitments are at risk and the exact issue and dates behind each flag." },
  { icon: "promise", title: "Commitment tracking", copy: "Keep each promise, due date, source link, and Jira issue together." },
  { icon: "spark", title: "AI recommendations", copy: "Ask the read-only Rovo agent to explain a risk and point you to the mitigation workflow." },
  { icon: "shield", title: "Confident delivery", copy: "Review a suggested mitigation and confirm creation of one Jira task when you’re ready." },
] satisfies { icon: IconName; title: string; copy: string }[];

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="RippleGuard home">
      <Image src="/rippleguard-logo.png" alt="" width={34} height={34} unoptimized />
      <span>RippleGuard</span>
    </a>
  );
}

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header" id="top">
        <div className="shell nav">
          <Brand />
          <nav aria-label="Main navigation">
            <a href="#demo">Demo</a>
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
          </nav>
          <a className="button button-small button-quiet" href={repository}><Icon name="github" /> GitHub</a>
        </div>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <p className="eyebrow"><span className="badge-dot" /> Built on Atlassian Forge</p>
              <h1 id="hero-title">Know the ripple<br className="hero-break" /> before it becomes <span>a problem.</span></h1>
              <p className="hero-description">RippleGuard connects customer promises to Jira work, so when a deadline moves, you can see what’s at risk and why.</p>
              <div className="actions">
                <a className="button button-primary" href="#demo"><Icon name="play" /> Watch the demo</a>
                <a className="button button-outline" href={repository}><Icon name="github" /> View on GitHub</a>
              </div>
              <ul className="hero-tags" aria-label="Highlights">
                <li><Icon name="graph" /> Impact analysis</li>
                <li><Icon name="promise" /> Delivery commitments</li>
                <li><Icon name="spark" /> Rovo explanations</li>
              </ul>
            </div>
            <div className="hero-art">
              <Image src="/rippleguard-hero.png" alt="RippleGuard character in a purple hoodie surrounded by six feature icons" width={1312} height={1199} unoptimized preload />
            </div>
          </div>
        </section>

        <section id="demo" className="section shell" aria-labelledby="demo-title">
          <div className="section-intro">
            <p className="kicker">Codegeist 2026 demo</p>
            <h2 id="demo-title">See RippleGuard in action.</h2>
            <p>Follow one delivery promise as a Jira date slips, the risk surfaces, and the team reviews a mitigation.</p>
          </div>
          <figure className="demo-frame">
            <video controls playsInline preload="none" poster="/rippleguard-thumbnail.jpg" aria-label="RippleGuard Codegeist 2026 demo">
              <source src="/rippleguard-demo.mp4" type="video/mp4" />
              <a href={youtube}>Watch the RippleGuard demo on YouTube</a>
            </video>
            <figcaption><span>4:21 · Narrated walkthrough with captions</span><a href={youtube}>Watch on YouTube <Icon name="arrow" /></a></figcaption>
          </figure>
        </section>

        <section id="features" className="section features" aria-labelledby="features-title">
          <div className="shell">
            <div className="section-intro">
              <p className="kicker">What RippleGuard does</p>
              <h2 id="features-title">From changes to decisions.</h2>
              <p>See what moved, understand which promise it affects, and decide what to do next.</p>
            </div>
            <div className="features-grid">
              {features.map(({ icon, title, copy }) => (
                <article className="feature" key={title}>
                  <span className={`feature-icon feature-icon-${icon}`}><Icon name={icon} /></span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="section shell workflow" aria-labelledby="workflow-title">
          <div className="workflow-visual">
            <p className="example-label">Example from the demo</p>
            <ol className="timeline">
              <li><span className="step-icon"><Icon name="promise" /></span><div><span>Customer promise</span><strong>Enterprise SSO</strong></div><time dateTime="2026-11-26">Nov 26</time></li>
              <li><span className="step-icon"><Icon name="change" /></span><div><span>Linked Jira task</span><strong>Due date moved</strong></div><time dateTime="2026-12-05">Dec 5</time></li>
              <li><span className="step-icon step-risk"><Icon name="risk" /></span><div><span>RippleGuard result</span><strong>Promise at risk</strong></div><span className="status">At risk</span></li>
            </ol>
          </div>
          <div className="workflow-copy">
            <p className="kicker">One change</p>
            <h2 id="workflow-title">A clearer picture across your team.</h2>
            <p>A linked task moves past the promised delivery date. RippleGuard flags the conflict and shows the evidence so the team can review a response.</p>
            <ul>
              <li><Icon name="shield" /> Trace the promise back to its recorded source.</li>
              <li><Icon name="shield" /> See which linked Jira work changed.</li>
              <li><Icon name="shield" /> Review a mitigation before creating a task.</li>
            </ul>
          </div>
        </section>

        <section className="shell closing" aria-labelledby="cta-title">
          <div className="cta">
            <div>
              <p className="kicker">Built for Atlassian Codegeist 2026</p>
              <h2 id="cta-title">Ready to see the ripple?</h2>
              <p>Explore the source and follow the judge walkthrough on GitHub.</p>
            </div>
            <a className="button button-light" href={repository}><Icon name="github" /> Explore the repo <Icon name="arrow" /></a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <Brand />
          <p>Built by Richmond Constante for Atlassian Codegeist 2026.</p>
          <nav aria-label="Footer navigation"><a href={repository}>GitHub</a><a href={youtube}>YouTube</a></nav>
        </div>
      </footer>
    </>
  );
}
