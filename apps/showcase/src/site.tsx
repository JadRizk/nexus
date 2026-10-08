import type { ReactNode } from "react";
import { GetStartedPage } from "./pages/GetStartedPage.js";
import { TokensPage } from "./pages/TokensPage.js";
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
}

const component = (
  slug: string,
  title: string,
  summary: string,
  render: () => ReactNode,
): DocPage => ({ path: `components/${slug}`, title, summary, render });

/** The component groups, which the sidebar and the index both show. */
export const COMPONENT_GROUPS: DocGroup[] = [
  {
    title: "Layout & type",
    pages: [
      component(
        "panel",
        "Panel",
        "The signature surface: hairline border, corner ticks, inset glow.",
        PanelPage,
      ),
      component(
        "hazard-rule",
        "HazardRule",
        "Decorative striped divider between chrome and content.",
        HazardRulePage,
      ),
      component(
        "section-heading",
        "SectionHeading",
        "A dense panel label that stays out of the heading outline.",
        SectionHeadingPage,
      ),
      component("wordmark", "Wordmark", "Stencil display type for the product name.", WordmarkPage),
      component(
        "blink-cursor",
        "BlinkCursor",
        "Block cursor blinking under the 3Hz flash limit.",
        BlinkCursorPage,
      ),
    ],
  },
  {
    title: "Controls",
    pages: [
      component(
        "button",
        "Button",
        "Action or toggle; the active state inverts to the accent.",
        ButtonPage,
      ),
      component(
        "tab-strip",
        "TabStrip",
        "WAI-ARIA tabs with roving focus and arrow-key movement.",
        TabStripPage,
      ),
      component(
        "slider",
        "Slider",
        "A restyled native range input with a formatted value.",
        SliderPage,
      ),
      component(
        "toggle-row",
        "ToggleRow",
        "A filter row backed by a real checkbox.",
        ToggleRowPage,
      ),
    ],
  },
  {
    title: "Data display",
    pages: [
      component(
        "key-value",
        "KeyValue",
        "Label and value on one row, truncating when narrow.",
        KeyValuePage,
      ),
      component("stat", "Stat", "A single labelled figure with an optional tone.", StatPage),
      component(
        "meter-row",
        "MeterRow",
        "A proportional bar with a real role=meter.",
        MeterRowPage,
      ),
      component("legend", "Legend", "Grouped filter rows, each group a fieldset.", LegendPage),
      component(
        "tooltip",
        "Tooltip",
        "Pointer-following label keyed to its subject's class.",
        TooltipPage,
      ),
      component(
        "glyph",
        "Glyph",
        "Six silhouettes so category never relies on colour alone.",
        GlyphPage,
      ),
      component(
        "link-glyph",
        "LinkGlyph",
        "Relation marks that pair colour with dash and arrow.",
        LinkGlyphPage,
      ),
    ],
  },
  {
    title: "Overlays",
    pages: [
      component("drawer", "Drawer", "Right-hand detail panel with a focus trap.", DrawerPage),
      component(
        "command-palette",
        "CommandPalette",
        "Ranked search in the ARIA combobox pattern.",
        CommandPalettePage,
      ),
    ],
  },
  {
    title: "App",
    pages: [
      component(
        "nexus-provider",
        "NexusProvider",
        "The root: theme and CRT state for everything below it.",
        NexusProviderPage,
      ),
    ],
  },
];

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
          "Three layers — primitive, semantic, component — read live from @nexus-cyberdeck/tokens.",
        render: TokensPage,
      },
      {
        path: "foundations/typography",
        title: "Typography",
        summary:
          "The type scale and the muted text ramp, the two things that change between themes.",
        render: TypographyPage,
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
      ...COMPONENT_GROUPS.flatMap((g) => g.pages),
    ],
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

export const DOC_PAGES: DocPage[] = DOC_GROUPS.flatMap((g) => g.pages);

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
