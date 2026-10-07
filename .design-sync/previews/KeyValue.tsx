import { KeyValue } from "@nexus-cyberdeck/react";

export function Rows() {
  return (
    <div style={{ width: 180 }}>
      <KeyValue label="NODES" value={200} />
      <KeyValue label="LINKS" value={616} />
      <KeyValue
        label="SOLVER"
        value={<span style={{ color: "var(--nx-fg-accent)" }}>LOCKED</span>}
      />
    </div>
  );
}
