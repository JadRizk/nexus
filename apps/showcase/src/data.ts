import type { GlyphShape, PaletteItem } from "@nexus/react";

/* ============================================================================
   showcase — sample data
   Stand-in corpus for the primitive/overlay demos. Shaped like the graph
   entities the design system was extracted from, without any of the graph
   itself.
   ========================================================================== */

export interface ClassDef {
  key: string;
  label: string;
  code: string;
  shape: GlyphShape;
  colour: string;
}

export const CLASSES: readonly ClassDef[] = [
  { key: "atlas", label: "Atlas", code: "ATL", shape: "hexagon", colour: "var(--nx-fg-accent)" },
  { key: "node", label: "Node", code: "NDE", shape: "circle", colour: "var(--nx-fg-info)" },
  { key: "signal", label: "Signal", code: "SIG", shape: "diamond", colour: "var(--nx-fg-warning)" },
  { key: "vector", label: "Vector", code: "VEC", shape: "square", colour: "var(--nx-fg-default)" },
];

export interface RelationDef {
  key: string;
  label: string;
  colour: string;
  dashed: boolean;
  arrow: boolean;
  width: number;
}

export const RELATIONS: readonly RelationDef[] = [
  { key: "link", label: "Link", colour: "#3AC6D4", dashed: false, arrow: false, width: 1.2 },
  { key: "cite", label: "Cite", colour: "var(--nx-fg-warning)", dashed: true, arrow: false, width: 1.2 },
  { key: "conflict", label: "Conflict", colour: "var(--nx-fg-critical)", dashed: false, arrow: true, width: 1.4 },
];

const NAMES = [
  "tidal_aperture", "cold_relay", "atlas_prime", "signal_drift", "vector_null",
  "amber_conduit", "dormant_shard", "quiet_relic", "static_bloom", "hollow_index",
  "verdant_key", "brittle_choir", "opal_fracture", "wan_current", "grey_atlas",
  "loose_thread", "far_signal", "narrow_vector", "faint_node", "steady_pulse",
  "cracked_lens", "idle_relay", "sunken_glyph", "spare_vector",
];

export const ITEMS: readonly PaletteItem[] = NAMES.map((label, i) => {
  const cls = CLASSES[i % CLASSES.length]!;
  return {
    id: i,
    label,
    code: cls.code,
    shape: cls.shape,
    colour: cls.colour,
    weight: NAMES.length - i,
  };
});
