import { useMemo, useState } from "react";
import { describeGraph } from "@nexus-cyberdeck/graph";
import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "@nexus-cyberdeck/graph";
import {
  Glyph,
  GraphOutline,
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

const outlineCategory = (
  label: string,
  shape: NodeCategory["shape"],
  color: string,
): NodeCategory => ({
  label,
  shape,
  color,
  code: label.slice(0, 3),
  size: 6,
  charge: 1,
  mass: 1,
  tier: 1,
});
const OUTLINE_NODE_CATEGORIES = {
  atlas: outlineCategory("ATLAS", 1, "#C6F135"),
  note: outlineCategory("NODE", 0, "#3AC6D4"),
  source: outlineCategory("SOURCE", 2, "#FF8A1E"),
} as const satisfies Record<string, NodeCategory>;
const OUTLINE_LINK_CATEGORIES = {
  refs: {
    label: "LINK",
    color: "#3AC6D4",
    width: 1,
    dist: 1,
    strength: 0.55,
    verb: "links to",
    inverseVerb: "linked from",
  },
  cites: {
    label: "CITE",
    color: "#FF8A1E",
    width: 1,
    dist: 1,
    strength: 0.8,
    verb: "cites",
    inverseVerb: "cited by",
  },
  conflicts: {
    label: "CONFLICT",
    color: "#FF2E63",
    width: 1,
    dist: 1,
    strength: 0.5,
    verb: "conflicts with",
    directed: false,
  },
} as const satisfies Record<string, LinkCategory>;
const OUTLINE_NODES: GraphNode[] = [
  { id: "ledger", categoryId: "atlas", label: "LEDGER//ATLAS" },
  { id: "folded", categoryId: "note", label: "folded_index" },
  { id: "brittle", categoryId: "note", label: "brittle_vector" },
  { id: "arxiv", categoryId: "source", label: "ARXIV-402" },
];
const OUTLINE_EDGES: GraphEdge[] = [
  { a: "ledger", b: "folded", categoryId: "refs" },
  { a: "ledger", b: "brittle", categoryId: "refs" },
  { a: "folded", b: "arxiv", categoryId: "cites" },
  { a: "brittle", b: "arxiv", categoryId: "cites" },
  { a: "folded", b: "brittle", categoryId: "conflicts" },
];

export function GraphOutlinePage() {
  const [selected, setSelected] = useState<string | number | null>(null);
  const outline = useMemo(
    () =>
      describeGraph({
        nodes: OUTLINE_NODES,
        edges: OUTLINE_EDGES,
        nodeCategories: OUTLINE_NODE_CATEGORIES,
        linkCategories: OUTLINE_LINK_CATEGORIES,
      }),
    [],
  );
  return (
    <Spec
      name="GraphOutline"
      note="The graph as a list: each category under a heading, each node a disclosure holding its
            connections, read the way the graph's keyboard navigation reads them. Feed it
            describeGraph() from @nexus-cyberdeck/graph."
      a11y="Built from native parts — a named region, real headings, <details> and buttons — so it
            works in every screen reader's browse mode. Each connection's far node is a button
            that opens and focuses that node's entry, so the list can be travelled like the graph."
      code={`<GraphOutline data={describeGraph({ nodes, edges, nodeCategories, linkCategories })} />`}
    >
      <div style={{ maxWidth: 420 }}>
        <GraphOutline
          data={outline}
          selectedId={selected}
          onSelect={setSelected}
          label="Sample graph as a list"
        />
      </div>
    </Spec>
  );
}
