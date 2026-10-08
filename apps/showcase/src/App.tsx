import { useEffect, useRef } from "react";
import {
  NexusProvider,
  Panel,
  Button,
  HazardRule,
  Wordmark,
  BlinkCursor,
  useNexus,
} from "@nexus-cyberdeck/react";
import type { NexusTheme } from "@nexus-cyberdeck/react";
import { HomePage } from "./pages/HomePage.js";
import { PrimitivesPage } from "./pages/PrimitivesPage.js";
import { OverlaysPage } from "./pages/OverlaysPage.js";
import { TokensPage } from "./pages/TokensPage.js";
import NexusCyberdeck from "./graph/NexusCyberdeck.js";
import GlitchLab from "./effects/GlitchLab.jsx";
import { href, useRoute } from "./router.js";

type Route = "home" | "graph" | "glitch" | "primitives" | "overlays" | "tokens" | "not-found";

const ROUTES: ReadonlyArray<{ id: Exclude<Route, "not-found">; label: string }> = [
  { id: "home", label: "Home" },
  { id: "graph", label: "Graph" },
  { id: "glitch", label: "Glitch Lab" },
  { id: "primitives", label: "Primitives" },
  { id: "overlays", label: "Overlays" },
  { id: "tokens", label: "Tokens" },
];

// Home, Graph and Glitch Lab are self-contained full-viewport "console"
// experiences — docked panels, no page-level padding or scroll. Graph and
// Glitch Lab in particular render their own WebGL surfaces (see README:
// "the graph itself ... is a product, not a design system") and ignore the
// site CRT toggle — Glitch Lab especially, since CRT composite is itself
// one of its shader effects, not something to layer a second time.
const FULL_BLEED: ReadonlySet<Route> = new Set(["home", "graph", "glitch"]);

// Home lives at the bare URL, so the address a visitor lands on and the one
// the Home link points at are the same.
const hrefFor = (id: Route) => (id === "home" ? href() : href(id));

function resolve(segment: string | undefined): Route {
  if (segment === undefined) return "home";
  return ROUTES.some((r) => r.id === segment) ? (segment as Route) : "not-found";
}

function Shell() {
  const route = resolve(useRoute()[0]);
  const { theme, setTheme, crt, setCrt } = useNexus();
  const main = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // A route change replaces the page, not the document, so the things a full
  // navigation would reset have to be reset by hand: the title a screen reader
  // and the tab strip read, the scroll offset <main> carries between pages, and
  // focus — left on the nav link, the next Tab would go back into the header
  // instead of into the page just opened. The first render is the document's
  // own load, which already starts at the top with focus on the body.
  useEffect(() => {
    const label = ROUTES.find((r) => r.id === route)?.label ?? "Not found";
    document.title = route === "home" ? "Nexus Cyberdeck — Showcase" : `${label} — Nexus Cyberdeck`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    main.current?.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [route]);

  return (
    <div
      className={crt ? "nx-crt nx-crt--roll" : ""}
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}
    >
      {/* skip link — first tab stop, WCAG 2.4.1 */}
      {/* The click is handled here rather than by the browser: the hash
          belongs to the router, and following "#main" would navigate to a
          route called "main". */}
      <a
        href="#main"
        className="nx-skip"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>

      {/* A banner landmark: screen-reader users can jump to it, and it gives
          the site chrome a name distinct from the theme controls the Home
          page renders in its own panel. */}
      <Panel
        role="banner"
        corners="none"
        padded={false}
        style={{
          flexShrink: 0,
          borderTop: 0,
          borderLeft: 0,
          borderRight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--nx-space-6)",
            padding: "var(--nx-space-4) var(--nx-space-6)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--nx-space-3)" }}>
            <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
            <span
              style={{
                color: "var(--nx-fg-tertiary)",
                fontSize: "var(--nx-text-2xs)",
                letterSpacing: "var(--nx-track-wider)",
              }}
            >
              DS v<span data-nx-version>{__NX_VERSION__}</span> <BlinkCursor />
            </span>
          </div>

          <nav aria-label="Sections" style={{ display: "flex", gap: "var(--nx-space-2)", flex: 1 }}>
            {/* Links, not buttons: each one goes somewhere, so it can be opened
                in a new tab or copied. They wear the button class so the
                header looks as it did; line-height and decoration are the two
                things a <button> gets from the UA sheet that an <a> does not. */}
            {ROUTES.map((r) => (
              <a
                key={r.id}
                href={hrefFor(r.id)}
                className="nx-btn"
                data-active={route === r.id ? "1" : "0"}
                aria-current={route === r.id ? "page" : undefined}
                style={{ lineHeight: "normal", textDecoration: "none" }}
              >
                {r.label}
              </a>
            ))}
          </nav>

          <div style={{ display: "flex", gap: "var(--nx-space-2)", alignItems: "center" }}>
            <span
              style={{
                color: "var(--nx-fg-tertiary)",
                fontSize: "var(--nx-text-2xs)",
                letterSpacing: "var(--nx-track-wide)",
              }}
            >
              THEME
            </span>
            {(["hud-aa", "hud"] as NexusTheme[]).map((t) => (
              <Button
                key={t}
                active={theme === t}
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
              >
                {t === "hud-aa" ? "AA" : "HUD"}
              </Button>
            ))}
            <Button active={crt} onClick={() => setCrt(!crt)} aria-pressed={crt}>
              CRT
            </Button>
          </div>
        </div>
        <HazardRule />
      </Panel>

      {/* tabIndex=0 because this element scrolls. A scrollable region that is
          not focusable cannot be scrolled by keyboard at all when it holds no
          focusable content of its own — which is exactly the Tokens page, a
          long column of swatches with nothing to tab to. It doubles as the
          skip link's landing target. */}
      <main
        ref={main}
        id="main"
        tabIndex={0}
        style={{ flex: 1, minHeight: 0, overflow: FULL_BLEED.has(route) ? "hidden" : "auto" }}
      >
        {route === "home" && <HomePage />}
        {route === "graph" && <NexusCyberdeck />}
        {route === "glitch" && <GlitchLab />}
        {!FULL_BLEED.has(route) && (
          <div style={{ padding: "var(--nx-space-7) var(--nx-space-6)", maxWidth: 980 }}>
            {route === "primitives" && <PrimitivesPage />}
            {route === "overlays" && <OverlaysPage />}
            {route === "tokens" && <TokensPage />}
            {route === "not-found" && <NotFoundPage />}
          </div>
        )}
      </main>

      {!FULL_BLEED.has(route) && (
        <footer
          style={{
            flexShrink: 0,
            padding: "var(--nx-space-6)",
            color: "var(--nx-fg-tertiary)",
            fontSize: "var(--nx-text-2xs)",
            letterSpacing: "var(--nx-track-wider)",
            textTransform: "uppercase",
            borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
          }}
        >
          Zero runtime dependencies · <span data-nx-figure>{__NX_TOKENS__}</span> tokens ·{" "}
          <span data-nx-figure>{__NX_COMPONENTS__}</span> components
          {route === "overlays" ? " · ⌘K opens the palette" : ""}
        </footer>
      )}
    </div>
  );
}

function NotFoundPage() {
  return (
    <>
      <h1 style={{ margin: 0, fontSize: "var(--nx-text-xl)", textTransform: "uppercase" }}>
        No such page
      </h1>
      <p style={{ color: "var(--nx-fg-subtle)" }}>
        Nothing lives at <code>{window.location.hash}</code>.{" "}
        <a href={href()} style={{ color: "var(--nx-fg-accent)" }}>
          Back to Home
        </a>
      </p>
    </>
  );
}

export default function App() {
  return (
    <NexusProvider theme="hud-aa" crt>
      <Shell />
    </NexusProvider>
  );
}
