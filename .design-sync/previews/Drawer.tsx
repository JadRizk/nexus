import type { CSSProperties } from "react";
import { Button, Drawer, Glyph, MeterRow, SectionHeading } from "@nexus-cyberdeck/react";

const ADJACENT = [
  { id: 1, label: "cold_relay", code: "NDE", colour: "var(--nx-fg-info)", shape: "circle" as const },
  { id: 2, label: "atlas_prime", code: "ATL", colour: "var(--nx-fg-accent)", shape: "hexagon" as const },
  { id: 3, label: "signal_drift", code: "SIG", colour: "var(--nx-fg-warning)", shape: "diamond" as const },
];

// The preview harness renders single-card stories inside a `transform`-ed
// wrapper (so fixed-position overlays stay inside the card instead of
// escaping to the page). That wrapper has no intrinsic height, which
// collapses Drawer's `position:fixed;top;bottom` sizing to 0. This inner
// div re-establishes a real, sized containing block for it — matching the
// card's configured viewport (see .design-sync/config.json overrides).
const STAGE: CSSProperties = { position: "relative", height: 520, transform: "translateZ(0)" };

export function Open() {
  return (
    <div style={STAGE}>
    <Drawer
      open
      onClose={() => {}}
      title="tidal_aperture"
      subtitle="0x493B · NDE"
      tone="info"
      icon={<Glyph shape="circle" tone="info" />}
      footer={<><Button style={{ flex: 1 }}>Focus</Button><Button style={{ flex: 1 }} active>Isolate</Button></>}
    >
      <SectionHeading>/// relation profile</SectionHeading>
      <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
      <MeterRow label="CITE" value={2} total={7} tone="warning" />
      <div style={{ height: 16 }} />
      <SectionHeading>/// adjacency [3]</SectionHeading>
      {ADJACENT.map((it) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
          <Glyph shape={it.shape} colour={it.colour} size={10} />
          <span style={{ flex: 1, color: it.colour, textTransform: "uppercase", letterSpacing: "0.04em" }}>{it.label}</span>
          <span style={{ color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{it.code}</span>
        </div>
      ))}
    </Drawer>
    </div>
  );
}
