import { Panel } from "@nexus/react";

export function Corners() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Panel corners={["tl", "br"]} style={{ width: 150 }}>tl · br</Panel>
      <Panel corners={["tl", "tr", "bl", "br"]} style={{ width: 150 }}>all four</Panel>
      <Panel corners="none" style={{ width: 150 }}>none</Panel>
      <Panel corners={["tl", "br"]} raised style={{ width: 150 }}>raised</Panel>
    </div>
  );
}

export function Composed() {
  return (
    <Panel corners={["tl", "br"]} raised style={{ width: 260 }}>
      <div style={{ color: "var(--nx-fg-accent)", fontWeight: 700, letterSpacing: "var(--nx-track-wide)", marginBottom: 8 }}>
        /// SUBJECT
      </div>
      <div>tidal_aperture</div>
      <div style={{ color: "var(--nx-fg-tertiary)", marginTop: 4 }}>0x493B · NDE · degree 7</div>
    </Panel>
  );
}
