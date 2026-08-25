import { Stat } from "@nexus/react";

export function Tones() {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Stat label="Class" value="NODE" tone="info" />
      <Stat label="State" value="DORMANT" tone="warning" />
      <Stat label="Conflict" value="2" tone="critical" />
      <Stat label="Signal" value="STABLE" tone="default" />
    </div>
  );
}
