import { useState } from "react";
import { Button, Glyph, Slider, TabStrip, ToggleRow } from "@nexus-cyberdeck/react";
import { Row, Spec } from "../../components/Spec.js";
import { CLASSES } from "../../data.js";

export function ButtonPage() {
  return (
    <Spec
      name="Button"
      note="Three states. The active state inverts to the accent colour rather than adding a
            border, so it reads at a glance in a dense control panel."
      code={`<Button active onClick={…}>Isolate</Button>`}
    >
      <Row>
        <Button>Default</Button>
        <Button active>Active</Button>
        <Button disabled>Disabled</Button>
      </Row>
    </Spec>
  );
}

export function TabStripPage() {
  const [tab, setTab] = useState<"optics" | "solver">("optics");
  return (
    <Spec
      name="TabStrip"
      a11y="Implements the WAI-ARIA tabs pattern: roving tabindex, arrow keys to move, Home
            and End to jump. The prototype used plain buttons with no keyboard model at all."
      code={`<TabStrip value={tab} onChange={setTab}\n  tabs={[{ value: "optics", label: "Optics" }]} />`}
    >
      <div style={{ maxWidth: 240 }}>
        <TabStrip
          value={tab}
          onChange={setTab}
          tabs={
            [
              { value: "optics", label: "Optics" },
              { value: "solver", label: "Solver" },
            ] as const
          }
        />
      </div>
    </Spec>
  );
}

export function SliderPage() {
  const [scan, setScan] = useState(0.55);
  return (
    <Spec
      name="Slider"
      note="A restyled native input, not a custom div. Keeping the native element means keyboard
            support, touch targets and screen-reader value announcement come for free."
      a11y="aria-valuetext carries the formatted value, so a screen reader announces '0.55'
            rather than the raw number. The track uses --nx-border-strong because a slider
            track is a UI component boundary needing 3:1 under WCAG 1.4.11."
      code={`<Slider label="scanlines" value={scan} min={0} max={1} step={0.02}\n  onChange={setScan} format={(v) => v.toFixed(2)} />`}
    >
      <div style={{ maxWidth: 260 }}>
        <Slider
          label="scanlines"
          value={scan}
          min={0}
          max={1}
          step={0.02}
          onChange={setScan}
          format={(v) => v.toFixed(2)}
        />
      </div>
    </Spec>
  );
}

export function ToggleRowPage() {
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(CLASSES.map((c) => [c.key, true])),
  );
  return (
    <Spec
      name="ToggleRow"
      a11y="Backed by a real checkbox that is visually hidden but still focusable and
            announced. The prototype used a div with an onClick handler — invisible to
            keyboards and screen readers alike."
      code={`<ToggleRow checked={on} onChange={setOn}\n  icon={<Glyph shape="hexagon" />} label="ATLAS" meta="ATL" />`}
    >
      <div style={{ maxWidth: 220 }}>
        {CLASSES.map((c) => (
          <ToggleRow
            key={c.key}
            checked={!!on[c.key]}
            onChange={(v) => setOn((p) => ({ ...p, [c.key]: v }))}
            icon={<Glyph shape={c.shape} colour={c.colour} muted={!on[c.key]} />}
            label={c.label}
            meta={c.code}
          />
        ))}
      </div>
    </Spec>
  );
}
