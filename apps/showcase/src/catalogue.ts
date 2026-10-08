/* ============================================================================
   showcase — component catalogue
   Every component, its route slug, its one-line summary and its group, as
   plain data. Kept apart from site.tsx, which pairs each entry with the page
   that renders it, so that anything needing only names and links — the
   token reference's "used by" notes, say — can import this without pulling
   in every page and forming an import cycle through the site map.
   ========================================================================== */

export const COMPONENT_CATALOGUE = [
  {
    group: "Layout & type",
    components: [
      {
        slug: "panel",
        title: "Panel",
        summary: "The signature surface: hairline border, corner ticks, inset glow.",
      },
      {
        slug: "hazard-rule",
        title: "HazardRule",
        summary: "Decorative striped divider between chrome and content.",
      },
      {
        slug: "section-heading",
        title: "SectionHeading",
        summary: "A dense panel label that stays out of the heading outline.",
      },
      {
        slug: "wordmark",
        title: "Wordmark",
        summary: "Stencil display type for the product name.",
      },
      {
        slug: "blink-cursor",
        title: "BlinkCursor",
        summary: "Block cursor blinking under the 3Hz flash limit.",
      },
    ],
  },
  {
    group: "Controls",
    components: [
      {
        slug: "button",
        title: "Button",
        summary: "Action or toggle; the active state inverts to the accent.",
      },
      {
        slug: "tab-strip",
        title: "TabStrip",
        summary: "WAI-ARIA tabs with roving focus and arrow-key movement.",
      },
      {
        slug: "slider",
        title: "Slider",
        summary: "A restyled native range input with a formatted value.",
      },
      {
        slug: "toggle-row",
        title: "ToggleRow",
        summary: "A filter row backed by a real checkbox.",
      },
    ],
  },
  {
    group: "Data display",
    components: [
      {
        slug: "key-value",
        title: "KeyValue",
        summary: "Label and value on one row, truncating when narrow.",
      },
      { slug: "stat", title: "Stat", summary: "A single labelled figure with an optional tone." },
      {
        slug: "meter-row",
        title: "MeterRow",
        summary: "A proportional bar with a real role=meter.",
      },
      { slug: "legend", title: "Legend", summary: "Grouped filter rows, each group a fieldset." },
      {
        slug: "tooltip",
        title: "Tooltip",
        summary: "Pointer-following label keyed to its subject's class.",
      },
      {
        slug: "glyph",
        title: "Glyph",
        summary: "Six silhouettes so category never relies on colour alone.",
      },
      {
        slug: "link-glyph",
        title: "LinkGlyph",
        summary: "Relation marks that pair colour with dash and arrow.",
      },
    ],
  },
  {
    group: "Overlays",
    components: [
      { slug: "drawer", title: "Drawer", summary: "Right-hand detail panel with a focus trap." },
      {
        slug: "command-palette",
        title: "CommandPalette",
        summary: "Ranked search in the ARIA combobox pattern.",
      },
    ],
  },
  {
    group: "App",
    components: [
      {
        slug: "nexus-provider",
        title: "NexusProvider",
        summary: "The root: theme and CRT state for everything below it.",
      },
    ],
  },
] as const;

export type ComponentSlug = (typeof COMPONENT_CATALOGUE)[number]["components"][number]["slug"];

/** The route path of a component's page, by its export name: "Button" → "components/button". */
export function componentPath(title: string): string | undefined {
  for (const group of COMPONENT_CATALOGUE) {
    const entry = group.components.find((c) => c.title === title);
    if (entry) return `components/${entry.slug}`;
  }
  return undefined;
}
