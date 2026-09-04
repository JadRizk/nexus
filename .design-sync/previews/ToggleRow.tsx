import { useState } from "react";
import { Glyph, ToggleRow } from "@nexus-cyberdeck/react";

const CLASSES = [
  { key: "atlas", label: "Atlas", code: "ATL", shape: "hexagon" as const, colour: "var(--nx-fg-accent)" },
  { key: "node", label: "Node", code: "NDE", shape: "circle" as const, colour: "var(--nx-fg-info)" },
  { key: "signal", label: "Signal", code: "SIG", shape: "diamond" as const, colour: "var(--nx-fg-warning)" },
];

export function ClassList() {
  const [on, setOn] = useState<Record<string, boolean>>({ atlas: true, node: true, signal: false });
  return (
    <div style={{ maxWidth: 220 }}>
      {CLASSES.map((c) => (
        <ToggleRow key={c.key} checked={!!on[c.key]}
          onChange={(v) => setOn((p) => ({ ...p, [c.key]: v }))}
          icon={<Glyph shape={c.shape} colour={c.colour} muted={!on[c.key]} />}
          label={c.label} meta={c.code} />
      ))}
    </div>
  );
}
