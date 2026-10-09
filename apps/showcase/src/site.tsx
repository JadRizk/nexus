import type { ReactNode } from "react";
import { COMPONENT_CATALOGUE } from "./catalogue.js";
import type { ComponentSlug } from "./catalogue.js";
import { GetStartedPage } from "./pages/GetStartedPage.js";
import { TokensPage } from "./pages/foundations/TokensPage.js";
import {
  ColourPage,
  ComponentTokensPage,
  DepthPage,
  MotionPage,
  SpacePage,
} from "./pages/foundations/Foundations.js";
import { TypographyPage } from "./pages/foundations/TypographyPage.js";
import {
  BlinkCursorPage,
  HazardRulePage,
  PanelPage,
  SectionHeadingPage,
  WordmarkPage,
} from "./pages/components/Layout.js";
import {
  ButtonPage,
  SliderPage,
  TabStripPage,
  ToggleRowPage,
} from "./pages/components/Controls.js";
import {
  GlyphPage,
  GraphOutlinePage,
  KeyValuePage,
  LegendPage,
  LinkGlyphPage,
  MeterRowPage,
  StatPage,
  TooltipPage,
} from "./pages/components/Data.js";
import { CommandPalettePage, DrawerPage } from "./pages/components/Overlays.js";
import { NexusProviderPage } from "./pages/components/Provider.js";
import { RankItemsPage, UseFocusTrapPage, UseHotkeyPage } from "./pages/Hooks.js";

/* ============================================================================
   showcase — site map
   Every documentation page, in reading order. Routing, the sidebar, the
   components index and the document title all read from this list, so a page
   added here is reachable everywhere at once and a page missing here is
   reachable nowhere.

   Home and the two labs (Graph, Glitch Lab) are full-viewport experiences
   rather than documentation, and are routed in App.tsx directly.
   ========================================================================== */

export interface DocPage {
  /** Route path without the leading "#/": "components/button". */
  path: string;
  title: string;
  /** The sidebar's label, when the title would repeat its group heading. */
  navLabel?: string;
  /** One line, shown under the title and on the components index. */
  summary: string;
  render: () => ReactNode;
}

export interface DocGroup {
  title: string;
  pages: DocPage[];
  /** Nested groups, listed after `pages` under their own headings. */
  subgroups?: DocGroup[];
}

/** Each component's page. Keyed by slug, so a catalogue entry without a page is a type error. */
const COMPONENT_PAGES: Record<ComponentSlug, () => ReactNode> = {
  panel: PanelPage,
  "hazard-rule": HazardRulePage,
  "section-heading": SectionHeadingPage,
  wordmark: WordmarkPage,
  "blink-cursor": BlinkCursorPage,
  button: ButtonPage,
  "tab-strip": TabStripPage,
  slider: SliderPage,
  "toggle-row": ToggleRowPage,
  "key-value": KeyValuePage,
  stat: StatPage,
  "meter-row": MeterRowPage,
  legend: LegendPage,
  tooltip: TooltipPage,
  glyph: GlyphPage,
  "link-glyph": LinkGlyphPage,
  "graph-outline": GraphOutlinePage,
  drawer: DrawerPage,
  "command-palette": CommandPalettePage,
  "nexus-provider": NexusProviderPage,
};

/** The component groups, which the sidebar and the index both show. */
export const COMPONENT_GROUPS: DocGroup[] = COMPONENT_CATALOGUE.map((group) => ({
  title: group.group,
  pages: group.components.map((c) => ({
    path: `components/${c.slug}`,
    title: c.title,
    summary: c.summary,
    render: COMPONENT_PAGES[c.slug],
  })),
}));

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Start",
    pages: [
      {
        path: "start",
        title: "Get started",
        summary: "Install the two packages and render a first panel.",
        render: GetStartedPage,
      },
    ],
  },
  {
    title: "Foundations",
    pages: [
      {
        path: "foundations/tokens",
        title: "Tokens",
        summary:
          "Three layers — primitive, semantic, component — and two themes. Every figure on these pages is read from @nexus-cyberdeck/tokens.",
        render: TokensPage,
      },
      {
        path: "foundations/colour",
        title: "Colour",
        summary:
          "Text, surface, border and focus roles, the palette behind them, and their contrast in both themes.",
        render: ColourPage,
      },
      {
        path: "foundations/typography",
        title: "Typography",
        summary:
          "The type scale and the muted text ramp, the two things that change between themes.",
        render: TypographyPage,
      },
      {
        path: "foundations/space",
        title: "Space & shape",
        summary: "The 2px spacing scale, hairlines, square corners and corner ticks.",
        render: SpacePage,
      },
      {
        path: "foundations/motion",
        title: "Motion",
        summary: "Three durations, one curve, and a blink capped below the flash threshold.",
        render: MotionPage,
      },
      {
        path: "foundations/depth",
        title: "Depth & effects",
        summary: "Glow, the overlay stacking order, the chromatic split and the CRT layer.",
        render: DepthPage,
      },
      {
        path: "foundations/component-tokens",
        title: "Component tokens",
        summary: "The hooks each component reads, for restyling it without forking it.",
        render: ComponentTokensPage,
      },
    ],
  },
  {
    title: "Components",
    pages: [
      {
        path: "components",
        title: "Components",
        navLabel: "Overview",
        summary: "Every component in @nexus-cyberdeck/react, by what it is for.",
        render: () => <ComponentsIndex />,
      },
    ],
    subgroups: COMPONENT_GROUPS,
  },
  {
    title: "Hooks & utilities",
    pages: [
      {
        path: "hooks/use-hotkey",
        title: "useHotkey",
        summary: "Global keyboard shortcuts with exact modifier matching.",
        render: UseHotkeyPage,
      },
      {
        path: "hooks/use-focus-trap",
        title: "useFocusTrap",
        summary: "Focus trap, restoration and Escape for a modal surface.",
        render: UseFocusTrapPage,
      },
      {
        path: "hooks/rank-items",
        title: "rankItems",
        summary: "The palette's deliberately non-fuzzy ranker, on its own.",
        render: RankItemsPage,
      },
    ],
  },
];

const pagesOf = (group: DocGroup): DocPage[] => [
  ...group.pages,
  ...(group.subgroups ?? []).flatMap(pagesOf),
];

export const DOC_PAGES: DocPage[] = DOC_GROUPS.flatMap(pagesOf);

export const findPage = (path: string) => DOC_PAGES.find((p) => p.path === path);

function ComponentsIndex() {
  return (
    <>
      {COMPONENT_GROUPS.map((group) => (
        <section key={group.title} style={{ marginBottom: "var(--nx-space-8)" }}>
          <h2
            style={{
              margin: "0 0 var(--nx-space-4)",
              color: "var(--nx-fg-tertiary)",
              fontSize: "var(--nx-text-2xs)",
              fontWeight: "var(--nx-weight-medium)",
              letterSpacing: "var(--nx-track-wider)",
              textTransform: "uppercase",
            }}
          >
            {group.title}
          </h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "var(--nx-space-5)",
            }}
          >
            {group.pages.map((p) => (
              <li key={p.path}>
                <a
                  href={`#/${p.path}`}
                  style={{
                    display: "block",
                    height: "100%",
                    boxSizing: "border-box",
                    padding: "var(--nx-space-5)",
                    border: "var(--nx-hairline) solid var(--nx-border-default)",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      color: "var(--nx-fg-accent)",
                      letterSpacing: "var(--nx-track-normal)",
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      marginTop: "var(--nx-space-2)",
                      color: "var(--nx-fg-subtle)",
                      lineHeight: "var(--nx-leading-body)",
                    }}
                  >
                    {p.summary}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
