import { useState } from "react";
import { TabStrip } from "@nexus-cyberdeck/react";

export function TwoTabs() {
  const [tab, setTab] = useState<"optics" | "solver">("optics");
  return (
    <div style={{ maxWidth: 240 }}>
      <TabStrip
        value={tab}
        onChange={setTab}
        tabs={[{ value: "optics", label: "Optics" }, { value: "solver", label: "Solver" }] as const}
      />
    </div>
  );
}

export function FourTabs() {
  const [tab, setTab] = useState("overview");
  return (
    <div style={{ maxWidth: 320 }}>
      <TabStrip
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "nodes", label: "Nodes" },
          { value: "links", label: "Links" },
          { value: "log", label: "Log" },
        ]}
      />
    </div>
  );
}
