import { Glyph, LinkGlyph, Legend } from "@nexus-cyberdeck/react";

const CLASSES = [
  { key: "atlas", label: "Atlas", shape: "hexagon" as const, colour: "var(--nx-fg-accent)" },
  { key: "node", label: "Node", shape: "circle" as const, colour: "var(--nx-fg-info)" },
  { key: "signal", label: "Signal", shape: "diamond" as const, colour: "var(--nx-fg-warning)" },
];
const RELATIONS = [
  { key: "link", label: "Link", colour: "#3AC6D4", dashed: false, arrow: false },
  {
    key: "conflict",
    label: "Conflict",
    colour: "var(--nx-fg-critical)",
    dashed: false,
    arrow: true,
  },
];

const row = (key: string, icon: JSX.Element, label: string) => (
  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
    {icon}
    <span style={{ color: "var(--nx-fg-default)" }}>{label}</span>
  </div>
);

export function Grouped() {
  return (
    <div style={{ width: 200 }}>
      <Legend
        groups={[
          {
            title: "classes",
            rows: (
              <>
                {CLASSES.map((c) =>
                  row(c.key, <Glyph shape={c.shape} colour={c.colour} size={14} />, c.label),
                )}
              </>
            ),
          },
          {
            title: "relations",
            rows: (
              <>
                {RELATIONS.map((r) =>
                  row(
                    r.key,
                    <LinkGlyph colour={r.colour} dashed={r.dashed} arrow={r.arrow} size={14} />,
                    r.label,
                  ),
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
