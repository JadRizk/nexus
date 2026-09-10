import { LinkGlyph } from "@nexus-cyberdeck/react";

const RELATIONS = [
  { key: "link", label: "Link", colour: "#3AC6D4", dashed: false, arrow: false, width: 1.2 },
  {
    key: "cite",
    label: "Cite",
    colour: "var(--nx-fg-warning)",
    dashed: true,
    arrow: false,
    width: 1.2,
  },
  {
    key: "conflict",
    label: "Conflict",
    colour: "var(--nx-fg-critical)",
    dashed: false,
    arrow: true,
    width: 1.4,
  },
];

export function AllRelations() {
  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      {RELATIONS.map((r) => (
        <div key={r.key} style={{ textAlign: "center", width: 78 }}>
          <LinkGlyph
            colour={r.colour}
            dashed={r.dashed}
            arrow={r.arrow}
            width={r.width}
            size={22}
          />
          <div
            style={{ marginTop: 6, color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}
          >
            {r.label}
          </div>
        </div>
      ))}
    </div>
  );
}
