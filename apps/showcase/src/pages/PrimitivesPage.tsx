import { useState } from "react";
import {
  Panel, HazardRule, SectionHeading, Wordmark, BlinkCursor, KeyValue, Stat,
  Button, TabStrip, Slider, ToggleRow, Glyph, LinkGlyph, GLYPH_SHAPES, Tooltip,
} from "@nexus-cyberdeck/react";
import { PageHeader, Spec, Row } from "../components/Spec.js";
import { CLASSES, RELATIONS } from "../data.js";

export function PrimitivesPage() {
  const [tab, setTab] = useState<"optics" | "solver">("optics");
  const [scan, setScan] = useState(0.55);
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(CLASSES.map((c) => [c.key, true])),
  );

  return (
    <>
      <PageHeader
        title="Primitives"
        lede="Every primitive is styled entirely from CSS custom properties, so none of them
              know which theme is active. Switching between HUD and AA in the header changes
              the muted ramp and the type scale without touching a single component."
      />

      <Spec
        name="Panel"
        note="The signature surface: hairline border, zero radius, inset acid glow, and corner
              ticks drawn as pseudo-elements. Two arms read as a bracket; four read as a box —
              a meaningfully different signal, so the corners are configurable."
        code={`<Panel corners={["tl", "br"]} raised>…</Panel>`}
      >
        <Row align="stretch">
          <Panel corners={["tl", "br"]} style={{ width: 150 }}>tl · br</Panel>
          <Panel corners={["tl", "tr", "bl", "br"]} style={{ width: 150 }}>all four</Panel>
          <Panel corners="none" style={{ width: 150 }}>none</Panel>
          <Panel corners={["tl", "br"]} raised style={{ width: 150 }}>raised</Panel>
        </Row>
      </Spec>

      <Spec
        name="Typography"
        note="Six sizes and four tracking values, down from eleven and thirteen in the prototype.
              Sizes are in rem so browser zoom and user font-size preferences work — WCAG 1.4.4."
        code={`<Wordmark>NEXUS</Wordmark>\n<SectionHeading>/// section</SectionHeading>`}
      >
        <Row gap="var(--nx-space-7)" align="flex-end">
          <Wordmark>NEXUS</Wordmark>
          <div>
            <SectionHeading>/// section heading</SectionHeading>
            <div style={{ color: "var(--nx-fg-default)" }}>
              default body text <BlinkCursor />
            </div>
          </div>
        </Row>
        <div style={{ marginTop: "var(--nx-space-5)" }}>
          {(["default", "muted", "subtle", "tertiary", "disabled"] as const).map((t) => (
            <div key={t} style={{
              color: `var(--nx-fg-${t})`, letterSpacing: "var(--nx-track-wide)",
              textTransform: "uppercase", padding: "1px 0",
            }}>{t} — the quick brown fox jumps over the lazy dog</div>
          ))}
        </div>
      </Spec>

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
            tabs={[{ value: "optics", label: "Optics" }, { value: "solver", label: "Solver" }] as const}
          />
        </div>
      </Spec>

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
          <Slider label="scanlines" value={scan} min={0} max={1} step={0.02}
            onChange={setScan} format={(v) => v.toFixed(2)} />
        </div>
      </Spec>

      <Spec
        name="ToggleRow"
        a11y="Backed by a real checkbox that is visually hidden but still focusable and
              announced. The prototype used a div with an onClick handler — invisible to
              keyboards and screen readers alike."
        code={`<ToggleRow checked={on} onChange={setOn}\n  icon={<Glyph shape="hexagon" />} label="ATLAS" meta="ATL" />`}
      >
        <div style={{ maxWidth: 220 }}>
          {CLASSES.map((c) => (
            <ToggleRow key={c.key} checked={!!on[c.key]}
              onChange={(v) => setOn((p) => ({ ...p, [c.key]: v }))}
              icon={<Glyph shape={c.shape} colour={c.colour} muted={!on[c.key]} />}
              label={c.label} meta={c.code} />
          ))}
        </div>
      </Spec>

      <Spec
        name="Glyph"
        note="Six distinct silhouettes. This is what satisfies WCAG 1.4.1 — category is never
              communicated by colour alone, which is the criterion most dark-neon systems fail."
        code={`<Glyph shape="hexagon" tone="accent" title="Atlas" />`}
      >
        <Row gap="var(--nx-space-6)">
          {GLYPH_SHAPES.map((s, i) => (
            <div key={s} style={{ textAlign: "center", width: 62 }}>
              <Glyph shape={s} size={22} colour={CLASSES[i % CLASSES.length]?.colour} />
              <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{s}</div>
            </div>
          ))}
        </Row>
      </Spec>

      <Spec
        name="LinkGlyph"
        note="Relation glyphs pair colour with a dash pattern and an optional arrowhead, so
              relation type survives greyscale printing and colour-vision differences."
        code={`<LinkGlyph colour="#3AC6D4" arrow dashed={false} />`}
      >
        <Row gap="var(--nx-space-6)">
          {RELATIONS.map((r) => (
            <div key={r.key} style={{ textAlign: "center", width: 78 }}>
              <LinkGlyph colour={r.colour} dashed={r.dashed} arrow={r.arrow} width={r.width} size={22} />
              <div style={{ marginTop: "var(--nx-space-2)", color: "var(--nx-fg-tertiary)", fontSize: "var(--nx-text-2xs)" }}>{r.label}</div>
            </div>
          ))}
        </Row>
      </Spec>

      <Spec name="KeyValue · Stat · HazardRule" code={`<KeyValue label="NODES" value={200} />`}>
        <Row gap="var(--nx-space-7)" align="flex-start">
          <div style={{ width: 170 }}>
            <KeyValue label="NODES" value={200} />
            <KeyValue label="LINKS" value={616} />
            <KeyValue label="SOLVER" value={<span style={{ color: "var(--nx-fg-accent)" }}>LOCKED</span>} />
          </div>
          <Row gap="var(--nx-space-6)">
            <Stat label="Class" value="NODE" tone="info" />
            <Stat label="State" value="DORMANT" tone="warning" />
            <Stat label="Conflict" value="2" tone="critical" />
          </Row>
        </Row>
        <HazardRule style={{ marginTop: "var(--nx-space-5)" }} />
      </Spec>

      <Spec name="Tooltip" note="Absolutely positioned, pointer-events none, accent bar keyed to the subject's class.">
        <div style={{ position: "relative", height: 54 }}>
          <Tooltip x={0} y={8} tone="info">
            <span style={{ color: "var(--nx-fg-info)" }}>tidal_aperture</span>
            <span style={{ color: "var(--nx-fg-tertiary)" }}> · NDE · 7</span>
          </Tooltip>
        </div>
      </Spec>
    </>
  );
}
