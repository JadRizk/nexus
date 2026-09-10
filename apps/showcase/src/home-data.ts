import type { GlyphShape, PaletteItem } from "@nexus-cyberdeck/react";

/* ============================================================================
   Home — sample data
   The dataset the landing-page console demo was designed against. Kept
   separate from the docs-page data.ts since it's shaped for this page's own
   entity/relation set (six classes including the ring glyph, five relations).
   ========================================================================== */

export interface ClassDef {
  key: string;
  label: string;
  code: string;
  shape: GlyphShape;
  colour: string;
}

export const CLASSES: readonly ClassDef[] = [
  { key: "atlas", label: "ATLAS", code: "ATL", shape: "hexagon", colour: "var(--nx-fg-accent)" },
  { key: "node", label: "NODE", code: "NDE", shape: "circle", colour: "var(--nx-fg-info)" },
  {
    key: "unrslv",
    label: "UNRSLV",
    code: "UNR",
    shape: "triangle",
    colour: "var(--nx-fg-critical)",
  },
  { key: "source", label: "SOURCE", code: "SRC", shape: "square", colour: "var(--nx-fg-warning)" },
  { key: "agent", label: "AGENT", code: "AGT", shape: "ring", colour: "var(--nx-fg-cat-violet)" },
  { key: "tag", label: "TAG", code: "TAG", shape: "diamond", colour: "var(--nx-fg-cat-lime)" },
];

export interface RelationDef {
  key: string;
  label: string;
  colour: string;
  dashed?: boolean;
  arrow?: boolean;
  width?: number;
}

export const RELATIONS: readonly RelationDef[] = [
  { key: "link", label: "LINK", colour: "#3AC6D4", arrow: true },
  { key: "cite", label: "CITE", colour: "var(--nx-fg-warning)", arrow: true, width: 1.5 },
  { key: "tagged", label: "TAGGED", colour: "var(--nx-fg-accent)", dashed: true, width: 0.9 },
  {
    key: "mention",
    label: "MENTION",
    colour: "var(--nx-fg-cat-violet)",
    dashed: true,
    arrow: true,
  },
  { key: "conflict", label: "CONFLICT", colour: "var(--nx-fg-critical)", width: 1.6 },
];

const RAW_ITEMS: ReadonlyArray<readonly [string, string, GlyphShape, string, number]> = [
  ["VECTOR//ATLAS", "ATL", "hexagon", "var(--nx-fg-accent)", 36],
  ["RESIDUE//ATLAS", "ATL", "hexagon", "var(--nx-fg-accent)", 24],
  ["tidal_aperture", "NDE", "circle", "var(--nx-fg-info)", 7],
  ["liminal_corpus", "NDE", "circle", "var(--nx-fg-info)", 9],
  ["narrow_relay", "NDE", "circle", "var(--nx-fg-info)", 5],
  ["#brittle", "TAG", "diamond", "var(--nx-fg-cat-lime)", 17],
  ["#recursive", "TAG", "diamond", "var(--nx-fg-cat-lime)", 16],
  ["FIELDLOG-294", "SRC", "square", "var(--nx-fg-warning)", 4],
  ["INTERCEPT-868", "SRC", "square", "var(--nx-fg-warning)", 3],
  ["ALDOURI", "AGT", "ring", "var(--nx-fg-cat-violet)", 6],
  ["?opaque_ledger", "UNR", "triangle", "var(--nx-fg-critical)", 3],
];

export const ITEMS: readonly PaletteItem[] = RAW_ITEMS.map(
  ([label, code, shape, colour, weight], id) => ({
    id,
    label,
    code,
    shape,
    colour,
    weight,
  }),
);
