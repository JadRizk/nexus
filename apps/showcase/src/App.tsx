import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  NexusProvider,
  Panel,
  Button,
  HazardRule,
  Wordmark,
  BlinkCursor,
  useNexus,
} from "@nexus-cyberdeck/react";
import { HomePage } from "./pages/HomePage.js";
import NexusCyberdeck from "./graph/NexusCyberdeck.js";
import GlitchLab from "./effects/lab/GlitchLab.js";
import { href, useRoute } from "./router.js";
import { DOC_GROUPS, findPage } from "./site.js";
import type { DocPage } from "./site.js";
import { PageHeader } from "./components/Spec.js";
import { SitePalette, useSitePalette } from "./components/SitePalette.js";
import { REPO } from "./repo.js";
import { useIsPhone } from "./phone.js";

type View =
  | { kind: "home" }
  | { kind: "graph" }
  | { kind: "glitch" }
  | { kind: "doc"; page: DocPage }
  | { kind: "not-found" };

// Home, Graph and Glitch Lab are full-bleed: no docs sidebar or page column.
// Graph and Glitch Lab are full-viewport "console" experiences — docked
// panels, no page-level scroll — and render their own WebGL surfaces (see README:
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
      return __NX_TITLE__;
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

/* The header names the site's destinations; the docs sidebar names the pages
   inside the documentation. Home is the wordmark, as on most sites, not a tab.
   Docs is one entry, current for any page under any of its sections, because
   every one of them opens the same sidebar layout. The two labs are docked
   desktop consoles with no phone layout, so a phone is not offered them
   (`desktopOnly`); a link straight to one still opens it. */
const NAV: readonly {
  label: string;
  path: string;
  sections?: readonly string[];
  desktopOnly?: boolean;
}[] = [
  { label: "Docs", path: "start", sections: ["start", "foundations", "components", "hooks"] },
  { label: "Graph", path: "labs/graph", desktopOnly: true },
  { label: "Glitch Lab", path: "labs/glitch", desktopOnly: true },
];

const isCurrent = (item: (typeof NAV)[number], path: string) =>
  path === item.path || !!item.sections?.includes(path.split("/")[0] ?? "");

/**
 * A route change replaces the page, not the document, so what a full
 * navigation would reset is reset by hand: <main>'s scroll offset, and focus —
 * left on the nav link, the next Tab would go back into the header instead of
 * into the page just opened. The first route is the document's own load, which
 * already starts at the top with focus on the body.
 *
 * A layout effect, called from Shell, so the reset lands before any page's own
 * effects run: a page that scrolls to an anchor of its own must not have that
 * undone.
 */
function useRouteReset(path: string, mainRef: RefObject<HTMLElement | null>) {
  // The route last shown; null until the first. Comparing routes rather than
  // counting runs keeps StrictMode's double-invoked effect from reading as a
  // navigation.
  const shown = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (shown.current !== null && shown.current !== path) {
      mainRef.current?.scrollTo(0, 0);
      mainRef.current?.focus({ preventScroll: true });
    }
    shown.current = path;
  }, [path, mainRef]);
}

/** The title a screen reader and the tab strip read. */
function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function Shell() {
  const path = useRoute().join("/");
  const view = resolve(path);
  const isDocked = view.kind === "graph" || view.kind === "glitch";
  // Theme and CRT are switched from the site palette (SitePalette.tsx).
  const { crt } = useNexus();
  const main = useRef<HTMLElement>(null);

  useRouteReset(path, main);
  useDocumentTitle(titleOf(view));

  return (
    <SitePalette path={path}>
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

        <SiteHeader path={path} />

        {/* tabIndex=0 because this element scrolls. A scrollable region that is
          not focusable cannot be scrolled by keyboard at all when it holds no
          focusable content of its own — which is exactly the Tokens page, a
          long column of swatches with nothing to tab to. It doubles as the
          skip link's landing target. */}
        <main
          ref={main}
          id="main"
          tabIndex={0}
          style={{
            flex: 1,
            minHeight: 0,
            // Home is full-bleed but long, so it scrolls in <main> like a docs
            // page — which also gives it the scroll reset on navigation.
            overflow: isDocked ? "hidden" : "auto",
            // A size container on docs pages, so the sticky sidebar can cap its
            // height at <main>'s visible height (100cqh) and scroll on its own.
            containerType: view.kind === "doc" ? "size" : undefined,
          }}
        >
          <RouteContent view={view} path={path} />
        </main>
      </div>
    </SitePalette>
  );
}

/**
 * A banner landmark: screen-reader users can jump to it, and tests scope the
 * theme and CRT controls to it.
 */
function SiteHeader({ path }: { path: string }) {
  return (
    <Panel
      role="banner"
      corners="none"
      padded={false}
      // No border: the hazard rule below is the header's only edge.
      style={{ flexShrink: 0, border: 0 }}
    >
      <div className="sc-header">
        <div className="sc-header__brand">
          <a
            href="#/"
            className="sc-brand"
            aria-label="Nexus, home"
            aria-current={path === "" ? "page" : undefined}
          >
            {/* Sized by .sc-brand in showcase.css. */}
            <Wordmark>NEXUS</Wordmark>
          </a>
          <span
            className="sc-header__version"
            style={{
              color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)",
              letterSpacing: "var(--nx-track-wider)",
            }}
          >
            v<span data-nx-version>{__NX_VERSION__}</span> <BlinkCursor />
          </span>
        </div>

        <NavLinks path={path} />

        <div className="sc-header__actions">
          <StarLink />
          <SearchButton />
        </div>
      </div>
      <HazardRule />
    </Panel>
  );
}

/**
 * Links, not buttons: each one goes somewhere, so it can be opened in a new
 * tab or copied. They wear the button class so the header looks as it did;
 * line-height and decoration are the two things a <button> gets from the UA
 * sheet that an <a> does not.
 */
function NavLinks({ path }: { path: string }) {
  return (
    <nav aria-label="Sections" className="sc-header__nav">
      {NAV.map((item) => (
        <a
          key={item.label}
          href={`#/${item.path}`}
          className={item.desktopOnly ? "nx-btn sc-desktop-only" : "nx-btn"}
          data-active={isCurrent(item, path) ? "1" : "0"}
          aria-current={path === item.path ? "page" : isCurrent(item, path) ? "true" : undefined}
          style={{ lineHeight: "normal", textDecoration: "none" }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function RouteContent({ view, path }: { view: View; path: string }) {
  switch (view.kind) {
    case "home":
      return <HomePage />;
    // Keyed, so "Open it anyway" on one lab is not carried to the other.
    case "graph":
      return (
        <DesktopLab key="graph" name="Graph">
          <NexusCyberdeck />
        </DesktopLab>
      );
    case "glitch":
      return (
        <DesktopLab key="glitch" name="Glitch Lab">
          <GlitchLab />
        </DesktopLab>
      );
    case "doc":
      return (
        <div className="sc-doc">
          <DocsNav path={path} title={view.page.navLabel ?? view.page.title} />
          {/* Sized as the page column was before the sidebar existed: the
            visual baselines capture each example at this width. */}
          <div style={{ flex: "1 1 auto", minWidth: 0, ...PAGE }}>
            <PageHeader title={view.page.title} lede={view.page.summary} />
            {/* Mounted as a component, never called as a function: a page's
              hooks must belong to the page, or moving between pages with
              different hooks breaks the shell's own hook order. Keyed by
              path so each page starts from fresh state. */}
            <view.page.render key={path} />
          </div>
        </div>
      );
    case "not-found":
      return (
        <div style={PAGE}>
          <NotFoundPage />
        </div>
      );
  }
}

/**
 * The site palette's visible way in, for anyone not reaching for ⌘K or "/" —
 * and the only control for theme and CRT, which the palette lists first.
 */
function SearchButton() {
  const { open } = useSitePalette();
  return (
    <Button onClick={open} aria-keyshortcuts="Meta+K Control+K /">
      Search{" "}
      <kbd
        className="sc-header__key"
        style={{ color: "var(--nx-fg-tertiary)", fontFamily: "inherit" }}
      >
        ⌘K
      </kbd>
    </Button>
  );
}

/** The repository, to star: a link in the button class, with GitHub's mark. */
function StarLink() {
  return (
    <a
      href={REPO}
      className="nx-btn sc-header__star"
      aria-label="Star Nexus on GitHub"
      style={{ lineHeight: "normal", textDecoration: "none" }}
    >
      <GitHubMark />
      Star
    </a>
  );
}

/** GitHub's mark (Octicons mark-github), in the label's colour. */
function GitHubMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

const PAGE = { padding: "var(--nx-space-7) var(--nx-space-6)", maxWidth: 980 } as const;

/**
 * The docs sidebar. Layout and states live in showcase.css (.sc-sidebar).
 * On a phone it folds away behind a toggle naming the current page, opens
 * in place above the page, and closes again once a page is chosen.
 */
function DocsNav({ path, title }: { path: string; title: string }) {
  const nav = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // A page chosen from the open list is a new route: fold the list away.
  useEffect(() => setIsOpen(false), [path]);

  // The sidebar scrolls on its own, so a page near the end of the list (a deep
  // link to Tooltip, say) would load with its own entry out of sight. Bring
  // the current link into the sidebar's view: by setting the sidebar's own
  // scrollTop, because scrollIntoView would scroll <main> as well.
  useLayoutEffect(() => {
    const box = nav.current;
    const current = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !current) return;
    const top = current.offsetTop;
    const bottom = top + current.offsetHeight;
    if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2;
    }
  }, [path]);

  const link = (page: DocPage) => (
    <li key={page.path}>
      <a
        href={`#/${page.path}`}
        className="sc-sidebar__link"
        aria-current={page.path === path ? "page" : undefined}
      >
        {page.navLabel ?? page.title}
      </a>
    </li>
  );

  return (
    <div className="sc-docnav">
      <button
        type="button"
        className="nx-btn sc-docnav__toggle"
        aria-expanded={isOpen}
        aria-controls="docs-pages"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Pages</span>
        <span className="sc-docnav__current">{title}</span>
        <span aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
      </button>
      <nav
        ref={nav}
        id="docs-pages"
        aria-label="Documentation"
        className="sc-sidebar"
        data-open={isOpen ? "1" : "0"}
      >
        {DOC_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="sc-sidebar__group">{group.title}</div>
            <ul className="sc-sidebar__list">{group.pages.map(link)}</ul>
            {group.subgroups?.map((sub) => (
              <div key={sub.title}>
                <div className="sc-sidebar__subgroup">{sub.title}</div>
                <ul className="sc-sidebar__list">{sub.pages.map(link)}</ul>
              </div>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}

/**
 * A lab is a docked desktop console with no phone layout. On a phone it is not
 * offered from the header, Home or Search; reached anyway (a shared link), it
 * says so before mounting, and lets the visitor open it regardless.
 */
function DesktopLab({ name, children }: { name: string; children: ReactNode }) {
  const isPhone = useIsPhone();
  const [isForced, setIsForced] = useState(false);
  if (!isPhone || isForced) return <>{children}</>;
  return (
    <div style={PAGE}>
      <h1 style={{ margin: 0, fontSize: "var(--nx-text-xl)", textTransform: "uppercase" }}>
        {name} is built for a desktop
      </h1>
      <p style={{ color: "var(--nx-fg-subtle)", lineHeight: "var(--nx-leading-body)" }}>
        It is a console of docked panels around a live canvas, laid out for a wide window. On a
        screen this narrow the panels do not fit.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--nx-space-3)" }}>
        <a href={href("start")} className="nx-btn sc-cta" data-active="1">
          Browse the docs
        </a>
        <a href={href()} className="nx-btn sc-cta">
          Home
        </a>
        <Button onClick={() => setIsForced(true)}>Open it anyway</Button>
      </div>
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
