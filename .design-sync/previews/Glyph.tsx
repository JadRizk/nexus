import { Glyph, GLYPH_SHAPES } from "@nexus-cyberdeck/react";

const COLOURS = [
  "var(--nx-fg-accent)",
  "var(--nx-fg-info)",
  "var(--nx-fg-warning)",
  "var(--nx-fg-default)",
];

export function AllShapes() {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      {GLYPH_SHAPES.map((s, i) => (
        <div key={s} style={{ textAlign: "center", width: 62 }}>
          <Glyph shape={s} size={22} colour={COLOURS[i % COLOURS.length]} />
          <div
            style={{ marginTop: 6, color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}
          >
            {s}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Muted() {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <Glyph shape="hexagon" tone="accent" title="Atlas" />
      <Glyph shape="hexagon" tone="accent" muted title="Atlas (muted)" />
    </div>
  );
}
