import { Tooltip } from "@nexus/react";

export function Default() {
  return (
    <div style={{ position: "relative", height: 54 }}>
      <Tooltip x={0} y={8} tone="info">
        <span style={{ color: "var(--nx-fg-info)" }}>tidal_aperture</span>
        <span style={{ color: "var(--nx-fg-tertiary)" }}> · NDE · 7</span>
      </Tooltip>
    </div>
  );
}

export function CriticalAccent() {
  return (
    <div style={{ position: "relative", height: 54 }}>
      <Tooltip x={0} y={8} tone="critical">
        <span style={{ color: "var(--nx-fg-critical)" }}>conflict detected</span>
      </Tooltip>
    </div>
  );
}
