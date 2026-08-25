import { HazardRule, KeyValue, Panel, Stat } from "@nexus/react";

export function Default() {
  return (
    <Panel corners="none" style={{ width: 260 }}>
      <KeyValue label="NODES" value={200} />
      <KeyValue label="LINKS" value={616} />
      <HazardRule style={{ marginTop: 12 }} />
    </Panel>
  );
}

export function WithStats() {
  return (
    <Panel corners="none" style={{ width: 300 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <Stat label="Class" value="NODE" tone="info" />
        <Stat label="Conflict" value="2" tone="critical" />
      </div>
      <HazardRule height={6} opacity={0.45} style={{ marginTop: 12 }} />
    </Panel>
  );
}
