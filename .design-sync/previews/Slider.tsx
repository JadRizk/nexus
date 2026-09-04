import { useState } from "react";
import { Slider } from "@nexus-cyberdeck/react";

export function Default() {
  const [scan, setScan] = useState(0.55);
  return (
    <div style={{ maxWidth: 260 }}>
      <Slider label="scanlines" value={scan} min={0} max={1} step={0.02}
        onChange={setScan} format={(v) => v.toFixed(2)} />
    </div>
  );
}

export function IntegerRange() {
  const [v, setV] = useState(42);
  return (
    <div style={{ maxWidth: 260 }}>
      <Slider label="repulsion" value={v} min={0} max={100} step={1} onChange={setV} />
    </div>
  );
}
