import { MeterRow } from "@nexus/react";

export function RelationDistribution() {
  return (
    <div style={{ maxWidth: 320 }}>
      <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
      <MeterRow label="CITE" value={2} total={7} colour="var(--nx-fg-warning)" />
      <MeterRow label="CONFLICT" value={1} total={7} colour="var(--nx-fg-critical)" />
    </div>
  );
}
