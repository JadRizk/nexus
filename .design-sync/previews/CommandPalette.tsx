import type { CSSProperties } from "react";
import { CommandPalette } from "@nexus-cyberdeck/react";
import type { PaletteItem } from "@nexus-cyberdeck/react";

// See Drawer.tsx: the single-card wrapper has no intrinsic height, so a
// `position:fixed` overlay needs its own sized, transformed containing
// block to lay out against (matches the card's configured viewport).
const STAGE: CSSProperties = { position: "relative", height: 520, transform: "translateZ(0)" };

const NAMES = [
  "tidal_aperture", "cold_relay", "atlas_prime", "signal_drift", "vector_null",
  "amber_conduit", "dormant_shard", "quiet_relic", "static_bloom", "hollow_index",
];
const CODES = ["ATL", "NDE", "SIG", "VEC"];
const SHAPES: PaletteItem["shape"][] = ["hexagon", "circle", "diamond", "square"];
const COLOURS = ["var(--nx-fg-accent)", "var(--nx-fg-info)", "var(--nx-fg-warning)", "var(--nx-fg-default)"];

const ITEMS: readonly PaletteItem[] = NAMES.map((label, i) => ({
  id: i,
  label,
  code: CODES[i % CODES.length],
  shape: SHAPES[i % SHAPES.length],
  colour: COLOURS[i % COLOURS.length],
  weight: NAMES.length - i,
}));

export function Open() {
  return (
    <div style={STAGE}>
      <CommandPalette
        open
        onClose={() => {}}
        items={ITEMS}
        onSelect={() => {}}
        renderMeta={(it) => (
          <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)", width: 22, textAlign: "right" }}>
            {it.weight}
          </span>
        )}
      />
    </div>
  );
}
