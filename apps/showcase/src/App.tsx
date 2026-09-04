import { useState } from "react";
import { NexusProvider, Panel, Button, HazardRule, Wordmark, BlinkCursor, useNexus } from "@nexus-cyberdeck/react";
import type { NexusTheme } from "@nexus-cyberdeck/react";
import { HomePage } from "./pages/HomePage.js";
import { PrimitivesPage } from "./pages/PrimitivesPage.js";
import { OverlaysPage } from "./pages/OverlaysPage.js";
import { TokensPage } from "./pages/TokensPage.js";
import NexusCyberdeck from "./graph/NexusCyberdeck.js";
import GlitchLab from "./effects/GlitchLab.jsx";

type Route = "home" | "graph" | "glitch" | "primitives" | "overlays" | "tokens";

const ROUTES: ReadonlyArray<{ id: Route; label: string }> = [
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

function Shell() {
  const [route, setRoute] = useState<Route>("home");
  const { theme, setTheme, crt, setCrt } = useNexus();

  return (
    <div className={crt ? "nx-crt nx-crt--roll" : ""}
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* skip link — first tab stop, WCAG 2.4.1 */}
      <a href="#main" className="nx-skip">Skip to content</a>

      {/* A banner landmark: screen-reader users can jump to it, and it gives
          the site chrome a name distinct from the theme controls the Home
          page renders in its own panel. */}
      <Panel role="banner" corners="none" padded={false} style={{
        flexShrink: 0, borderTop: 0, borderLeft: 0, borderRight: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--nx-space-6)",
          padding: "var(--nx-space-4) var(--nx-space-6)", flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--nx-space-3)" }}>
            <Wordmark size="var(--nx-text-lg)">NEXUS</Wordmark>
            <span style={{
              color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wider)",
            }}>DS v<span data-nx-version>{__NX_VERSION__}</span> <BlinkCursor /></span>
          </div>

          <nav aria-label="Sections" style={{ display: "flex", gap: "var(--nx-space-2)", flex: 1 }}>
            {ROUTES.map((r) => (
              <Button key={r.id} active={route === r.id}
                aria-current={route === r.id ? "page" : undefined}
                onClick={() => setRoute(r.id)}>{r.label}</Button>
            ))}
          </nav>

          <div style={{ display: "flex", gap: "var(--nx-space-2)", alignItems: "center" }}>
            <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wide)" }}>
              THEME
            </span>
            {(["hud-aa", "hud"] as NexusTheme[]).map((t) => (
              <Button key={t} active={theme === t} onClick={() => setTheme(t)}
                aria-pressed={theme === t}>{t === "hud-aa" ? "AA" : "HUD"}</Button>
            ))}
            <Button active={crt} onClick={() => setCrt(!crt)} aria-pressed={crt}>CRT</Button>
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
          </div>
        )}
      </main>

      {!FULL_BLEED.has(route) && (
        <footer style={{
          flexShrink: 0, padding: "var(--nx-space-6)", color: "var(--nx-fg-tertiary)",
          fontSize: "var(--nx-text-2xs)", letterSpacing: "var(--nx-track-wider)",
          textTransform: "uppercase", borderTop: "var(--nx-hairline) solid var(--nx-border-default)",
        }}>
          {`Zero runtime dependencies · ${__NX_TOKENS__} tokens · ${__NX_COMPONENTS__} components${route === "overlays" ? " · ⌘K opens the palette" : ""}`}
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <NexusProvider theme="hud-aa" crt>
      <Shell />
    </NexusProvider>
  );
}
