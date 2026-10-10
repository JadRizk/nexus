import type { CSSProperties } from "react";
import { Wordmark } from "@nexus-cyberdeck/react";
import { SignalMonitor } from "../components/SignalMonitor.js";
import { REPO } from "../repo.js";

/* ============================================================================
   Home — the landing page
   A hero that says what this is and lets you play with it, the routes into
   the site under it, and a footer. Every claim is the README's; every figure
   is a build-time constant (scripts/ds-figures.mjs), never typed here. Theme,
   CRT and search are the site palette's (⌘K, or Search in the header).
   ========================================================================== */

// The labs are desktop consoles: not offered on a phone, as in the header.
const ROUTES: ReadonlyArray<{
  path: string;
  label: string;
  blurb: string;
  desktopOnly?: boolean;
}> = [
  { path: "start", label: "Get started", blurb: "Install and render a first panel." },
  { path: "foundations/tokens", label: "Tokens", blurb: "Every token, both themes." },
  { path: "components", label: "Components", blurb: "Each one live, with a11y notes." },
  { path: "labs/graph", label: "Graph", blurb: "The WebGL canvas, running.", desktopOnly: true },
  {
    path: "labs/glitch",
    label: "Glitch Lab",
    blurb: "The signal path, every knob.",
    desktopOnly: true,
  },
];

const BODY: CSSProperties = {
  margin: 0,
  color: "var(--nx-fg-subtle)",
  lineHeight: "var(--nx-leading-body)",
};

export function HomePage() {
  return (
    <div className="sc-home">
      <section aria-labelledby="home-title" className="sc-home__hero">
        <div className="sc-home__pitch">
          <h1
            id="home-title"
            style={{
              margin: 0,
              color: "var(--nx-fg-default)",
              fontFamily: "var(--nx-font-stencil)",
              fontSize: "calc(var(--nx-text-xl) * 1.75)",
              fontWeight: "var(--nx-weight-regular)" as CSSProperties["fontWeight"],
              lineHeight: "var(--nx-leading-tight)",
              letterSpacing: "var(--nx-track-normal)",
              textTransform: "uppercase",
            }}
          >
            A HUD design system for React
          </h1>
          <p style={{ ...BODY, marginTop: "var(--nx-space-5)", fontSize: "var(--nx-text-md)" }}>
            Acid green on near-black, hairline borders, monospace everything — and an accessible
            mode that is enforced at build time, not promised. It ships with a WebGL graph canvas
            that speaks the same language.
          </p>
          <p
            style={{
              ...BODY,
              marginTop: "var(--nx-space-5)",
              color: "var(--nx-fg-muted)",
              fontSize: "var(--nx-text-xs)",
              letterSpacing: "var(--nx-track-wide)",
              textTransform: "uppercase",
            }}
          >
            <span data-nx-figure>{__NX_COMPONENTS__}</span> components ·{" "}
            <span data-nx-figure>{__NX_TOKENS__}</span> tokens · 2 themes · React 18.3 or 19
          </p>
          <div className="sc-home__ctas">
            {/* Links wearing the button class, as the header's are: they go
                somewhere, so they can be opened in a new tab or copied. */}
            <a href="#/start" className="nx-btn sc-cta" data-active="1">
              Get started
            </a>
            <a href="#/components" className="nx-btn sc-cta">
              Browse components
            </a>
          </div>
        </div>
        <SignalMonitor />
      </section>

      <nav aria-label="Where to go" className="sc-home__routes">
        {ROUTES.map((r) => (
          <a
            key={r.path}
            href={`#/${r.path}`}
            className={r.desktopOnly ? "sc-route sc-desktop-only" : "sc-route"}
          >
            <span className="sc-route__label">{r.label} →</span>
            <span className="sc-route__blurb">{r.blurb}</span>
          </a>
        ))}
      </nav>

      <footer className="sc-footer">
        <div className="sc-footer__brand">
          <Wordmark size="var(--nx-text-md)">NEXUS</Wordmark>
          <span>
            v<span data-nx-version>{__NX_VERSION__}</span> · MIT
          </span>
        </div>
        <ul className="sc-footer__links" aria-label="Project">
          <li>
            <a href={REPO}>GitHub</a>
          </li>
          <li>
            <a href={`${REPO}/blob/main/docs/getting-started.md`}>Guide</a>
          </li>
          <li>
            <a href={`${REPO}/blob/main/LICENSE`}>License</a>
          </li>
        </ul>
      </footer>
    </div>
  );
}
