import { useLayoutEffect, useRef } from "react";
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
import NexusCyberdeck from "./graph/NexusCyberdeck.js";
import GlitchLab from "./effects/GlitchLab.jsx";
import { href, useRoute } from "./router.js";
import { COMPONENT_GROUPS, DOC_GROUPS, findPage } from "./site.js";
import type { DocPage } from "./site.js";
import { PageHeader } from "./components/Spec.js";

type View =
  | { kind: "home" }
  | { kind: "graph" }
  | { kind: "glitch" }
  | { kind: "doc"; page: DocPage }
  | { kind: "not-found" };

// Home, Graph and Glitch Lab are self-contained full-viewport "console"
// experiences — docked panels, no page-level padding or scroll. Graph and
// Glitch Lab in particular render their own WebGL surfaces (see README:
// "the graph itself ... is a product, not a design system") and ignore the
// site CRT toggle — Glitch Lab especially, since CRT composite is itself
// one of its shader effects, not something to layer a second time. Every
// other page is documentation, listed in site.tsx.
function resolve(path: string): View {
  if (path === "") return { kind: "home" };
  if (path === "labs/graph") return { kind: "graph" };
  if (path === "labs/glitch") return { kind: "glitch" };
  const page = findPage(path);
  return page ? { kind: "doc", page } : { kind: "not-found" };
}

function titleOf(view: View): string {
  switch (view.kind) {
    case "home":
      return "Nexus Cyberdeck — Showcase";
    case "graph":
      return "Graph — Nexus Cyberdeck";
    case "glitch":
      return "Glitch Lab — Nexus Cyberdeck";
    case "doc":
      return `${view.page.title} — Nexus Cyberdeck`;
    case "not-found":
      return "Not found — Nexus Cyberdeck";
  }
}

/* The header names the site's sections; the sidebar names the pages inside
   the documentation ones. A section is current for any page under it. */
const NAV: ReadonlyArray<{ label: string; path: string; section?: string }> = [
  { label: "Home", path: "" },
  { label: "Get started", path: "start" },
  { label: "Foundations", path: "foundations/tokens", section: "foundations" },
  { label: "Components", path: "components", section: "components" },
  { label: "Hooks", path: "hooks/use-hotkey", section: "hooks" },
  { label: "Graph", path: "labs/graph" },
  { label: "Glitch Lab", path: "labs/glitch" },
];

const isCurrent = (item: (typeof NAV)[number], path: string) =>
  path === item.path || (!!item.section && path.split("/")[0] === item.section);

function Shell() {
  const path = useRoute().join("/");
  const view = resolve(path);
  const title = titleOf(view);
  const fullBleed = view.kind === "home" || view.kind === "graph" || view.kind === "glitch";
  const { theme, setTheme, crt, setCrt } = useNexus();
  const main = useRef<HTMLElement>(null);
  // The route last shown. Null until the first one, which is the document's own
  // load. Comparing routes rather than counting runs is what keeps StrictMode's
  // double-invoked effect in development from reading as a navigation.
  const shown = useRef<string | null>(null);

  // A route change replaces the page, not the document, so the things a full
  // navigation would reset have to be reset by hand: the title a screen reader
  // and the tab strip read, the scroll offset <main> carries between pages, and
  // focus — left on the nav link, the next Tab would go back into the header
  // instead of into the page just opened. The first render is the document's
  // own load, which already starts at the top with focus on the body.
  //
  // A layout effect, so the reset lands before any page's own effects run: a
  // page that scrolls to an anchor of its own must not have that undone.
  useLayoutEffect(() => {
    document.title = title;
    if (shown.current !== null && shown.current !== path) {
      main.current?.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }
    shown.current = path;
  }, [path, title]);

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
            {NAV.map((item) => (
              <a
                key={item.label}
                href={`#/${item.path}`}
                className="nx-btn"
                data-active={isCurrent(item, path) ? "1" : "0"}
                aria-current={
                  path === item.path ? "page" : isCurrent(item, path) ? "true" : undefined
                }
                style={{ lineHeight: "normal", textDecoration: "none" }}
              >
                {item.label}
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
        style={{ flex: 1, minHeight: 0, overflow: fullBleed ? "hidden" : "auto" }}
      >
        {view.kind === "home" && <HomePage />}
        {view.kind === "graph" && <NexusCyberdeck />}
        {view.kind === "glitch" && <GlitchLab />}
        {view.kind === "doc" && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <DocsNav path={path} />
            {/* Sized as the page column was before the sidebar existed: the
                visual baselines capture each example at this width. */}
            <div style={{ flex: "1 1 auto", minWidth: 0, ...PAGE }}>
              <PageHeader title={view.page.title} lede={view.page.summary} />
              {view.page.render()}
            </div>
          </div>
        )}
        {view.kind === "not-found" && (
          <div style={PAGE}>
            <NotFoundPage />
          </div>
        )}
      </main>

      {!fullBleed && (
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
          {path === "components/command-palette" ? " · ⌘K opens the palette" : ""}
        </footer>
      )}
    </div>
  );
}

const PAGE = { padding: "var(--nx-space-7) var(--nx-space-6)", maxWidth: 980 } as const;

function DocsNav({ path }: { path: string }) {
  const link = (page: DocPage) => {
    const current = page.path === path;
    return (
      <li key={page.path}>
        <a
          href={`#/${page.path}`}
          aria-current={current ? "page" : undefined}
          style={{
            display: "block",
            padding: "var(--nx-space-2) var(--nx-space-4)",
            borderLeft: `2px solid ${current ? "var(--nx-fg-accent)" : "transparent"}`,
            color: current ? "var(--nx-fg-accent)" : "var(--nx-fg-subtle)",
            textDecoration: "none",
          }}
        >
          {page.navLabel ?? page.title}
        </a>
      </li>
    );
  };
  const heading = (title: string, level: "group" | "sub") => (
    <div
      style={{
        padding:
          level === "group"
            ? "var(--nx-space-6) 0 var(--nx-space-3)"
            : "var(--nx-space-4) var(--nx-space-4) var(--nx-space-2)",
        color: "var(--nx-fg-tertiary)",
        fontSize: "var(--nx-text-2xs)",
        letterSpacing: "var(--nx-track-wider)",
        textTransform: "uppercase",
      }}
    >
      {title}
    </div>
  );
  const list = { listStyle: "none", margin: 0, padding: 0 } as const;

  return (
    <nav
      aria-label="Documentation"
      style={{
        flex: "0 0 200px",
        boxSizing: "border-box",
        padding: "var(--nx-space-2) var(--nx-space-5) var(--nx-space-7) var(--nx-space-6)",
        borderRight: "var(--nx-hairline) solid var(--nx-border-default)",
        alignSelf: "stretch",
      }}
    >
      {DOC_GROUPS.map((group) => (
        <div key={group.title}>
          {heading(group.title, "group")}
          {group.title === "Components" ? (
            <>
              <ul style={list}>{link(group.pages[0]!)}</ul>
              {COMPONENT_GROUPS.map((sub) => (
                <div key={sub.title}>
                  {heading(sub.title, "sub")}
                  <ul style={list}>{sub.pages.map(link)}</ul>
                </div>
              ))}
            </>
          ) : (
            <ul style={list}>{group.pages.map(link)}</ul>
          )}
        </div>
      ))}
    </nav>
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
