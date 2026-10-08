import { useState } from "react";
import {
  Glyph,
  KeyValue,
  Legend,
  LinkGlyph,
  GLYPH_SHAPES,
  MeterRow,
  Stat,
  ToggleRow,
  Tooltip,
} from "@nexus-cyberdeck/react";
import { Row, Spec } from "../../components/Spec.js";
import { CLASSES, RELATIONS } from "../../data.js";

export function KeyValuePage() {
  return (
    <Spec
      name="KeyValue"
      note="A label/value row that truncates rather than clips when its column is narrower
            than both at full width."
      code={`<KeyValue label="NODES" value={200} />`}
    >
      <div style={{ width: 170 }}>
        <KeyValue label="NODES" value={200} />
        <KeyValue label="LINKS" value={616} />
        <KeyValue
          label="SOLVER"
          value={<span style={{ color: "var(--nx-fg-accent)" }}>LOCKED</span>}
        />
      </div>
    </Spec>
  );
}

export function StatPage() {
  return (
    <Spec
      name="Stat"
      note="A single labelled figure. The tone colours the value only; the label stays neutral
            so a row of stats still scans as one group."
      code={`<Stat label="State" value="DORMANT" tone="warning" />`}
    >
      <Row gap="var(--nx-space-6)">
        <Stat label="Class" value="NODE" tone="info" />
        <Stat label="State" value="DORMANT" tone="warning" />
        <Stat label="Conflict" value="2" tone="critical" />
      </Row>
    </Spec>
  );
}

export function MeterRowPage() {
  return (
    <Spec
      name="MeterRow"
      note="A proportional bar with a real role=meter, not a decorative div. Used inside the
            drawer to show relation distribution at a glance."
      a11y="aria-valuenow / valuemin / valuemax with a composed aria-label, so the value is
            announced as '5 of 7' rather than read as an unlabelled graphic."
      code={`<MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />`}
    >
      <div style={{ maxWidth: 320 }}>
        <MeterRow label="LINK" value={5} total={7} colour="#3AC6D4" />
        <MeterRow label="CITE" value={2} total={7} tone="warning" />
        <MeterRow label="CONFLICT" value={1} total={7} tone="critical" />
      </div>
    </Spec>
  );
}

export function LegendPage() {
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(CLASSES.map((c) => [c.key, true])),
  );
  const [rel, setRel] = useState<Record<string, boolean>>(
    Object.fromEntries(RELATIONS.map((r) => [r.key, true])),
  );
  return (
    <Spec
      name="Legend"
      note="Groups of filter rows under a heading. Each group is a fieldset, so the heading is
            bound to its rows rather than sitting above them."
      a11y="The group title renders inside a <legend>, which is what a screen reader announces
            on entering any row in the group."
      code={`<Legend groups={[{ title: "entity class", rows: <>…ToggleRow…</> }]} />`}
    >
      <div style={{ maxWidth: 220 }}>
        <Legend
          groups={[
            {
              title: "entity class",
              rows: CLASSES.map((c) => (
                <ToggleRow
                  key={c.key}
                  checked={!!on[c.key]}
                  onChange={(v) => setOn((p) => ({ ...p, [c.key]: v }))}
                  icon={<Glyph shape={c.shape} colour={c.colour} muted={!on[c.key]} />}
                  label={c.label}
                  meta={c.code}
                />
              )),
            },
            {
              title: "relation",
              rows: RELATIONS.map((r) => (
                <ToggleRow
                  key={r.key}
                  checked={!!rel[r.key]}
                  onChange={(v) => setRel((p) => ({ ...p, [r.key]: v }))}
                  icon={
                    <LinkGlyph
                      colour={r.colour}
                      muted={!rel[r.key]}
                      dashed={r.dashed}
                      arrow={r.arrow}
                      width={r.width}
                    />
                  }
                  label={r.label}
                />
              )),
            },
          ]}
        />
      </div>
    </Spec>
  );
}

export function TooltipPage() {
  return (
    <Spec
      name="Tooltip"
      note="Absolutely positioned, pointer-events none, accent bar keyed to the subject's class."
    >
      <div style={{ position: "relative", height: 54 }}>
        <Tooltip x={0} y={8} tone="info">
          <span style={{ color: "var(--nx-fg-info)" }}>tidal_aperture</span>
          <span style={{ color: "var(--nx-fg-tertiary)" }}> · NDE · 7</span>
        </Tooltip>
      </div>
    </Spec>
  );
}

export function GlyphPage() {
  return (
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
            <div
              style={{
                marginTop: "var(--nx-space-2)",
                color: "var(--nx-fg-tertiary)",
                fontSize: "var(--nx-text-2xs)",
              }}
            >
              {s}
            </div>
          </div>
        ))}
      </Row>
    </Spec>
  );
}

export function LinkGlyphPage() {
  return (
    <Spec
      name="LinkGlyph"
      note="Relation glyphs pair colour with a dash pattern and an optional arrowhead, so
            relation type survives greyscale printing and colour-vision differences."
      code={`<LinkGlyph colour="#3AC6D4" arrow dashed={false} />`}
    >
      <Row gap="var(--nx-space-6)">
        {RELATIONS.map((r) => (
          <div key={r.key} style={{ textAlign: "center", width: 78 }}>
            <LinkGlyph
              colour={r.colour}
              dashed={r.dashed}
              arrow={r.arrow}
              width={r.width}
              size={22}
            />
            <div
              style={{
                marginTop: "var(--nx-space-2)",
                color: "var(--nx-fg-tertiary)",
                fontSize: "var(--nx-text-2xs)",
              }}
            >
              {r.label}
            </div>
          </div>
        ))}
      </Row>
    </Spec>
  );
}
