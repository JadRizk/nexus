import { describe, expect, it } from "vitest";
import {
  createLabelPlacer,
  type LabelMode,
  type LabelView,
  type MeasureText,
  type PlacedLabel,
} from "./labels.js";
import type { Viewport } from "./camera.js";

const VIEWPORT: Viewport = { width: 800, height: 600, curve: 0 };

// Text-independent, so every fixture's box is 17px wide (10 + 7, empty labels).
const STUB_MEASURE: MeasureText = () => 10;

interface NodeFixture {
  x: number;
  y: number;
  hidden?: boolean;
  radius?: number;
  depth?: number;
  tier?: number;
  label?: string;
}

function makeView(
  nodes: NodeFixture[],
  overrides: Partial<
    Omit<LabelView, "count" | "pos" | "hidden" | "radii" | "depth" | "tier" | "label">
  > = {},
): LabelView {
  const nodeCount = nodes.length;
  const positions = new Float32Array(nodeCount * 2),
    hidden = new Float32Array(nodeCount),
    radii = new Float32Array(nodeCount);
  const depth = new Float32Array(nodeCount),
    tier = new Float32Array(nodeCount);
  const labels = nodes.map((node) => node.label ?? "");
  nodes.forEach((node, i) => {
    positions[i * 2] = node.x;
    positions[i * 2 + 1] = node.y;
    hidden[i] = node.hidden ? 1 : 0;
    radii[i] = node.radius ?? 0;
    depth[i] = node.depth ?? -1;
    tier[i] = node.tier ?? 3;
  });
  return {
    count: nodeCount,
    pos: positions,
    hidden,
    radii,
    depth,
    tier,
    label: (index) => labels[index]!,
    zoom: 1,
    cx: 0,
    cy: 0,
    viewport: VIEWPORT,
    mode: "all",
    selIdx: -1,
    hoverIdx: -1,
    ...overrides,
  };
}

function place(
  nodes: NodeFixture[],
  overrides?: Partial<LabelView>,
  poolSize = 60,
): { out: Map<number, PlacedLabel>; count: number } {
  const placer = createLabelPlacer({ poolSize, labelHeight: 11, measure: STUB_MEASURE });
  const out = new Map<number, PlacedLabel>();
  const count = placer.place(makeView(nodes, overrides), out);
  return { out, count };
}

describe("createLabelPlacer / modes", () => {
  it("off places nothing", () => {
    const { out } = place(
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      { mode: "off" as LabelMode },
    );
    expect(out.size).toBe(0);
  });

  it("all places everything visible and in-view, up to the pool cap", () => {
    const { out } = place(
      [
        { x: -200, y: 0 },
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      { mode: "all" as LabelMode },
    );
    expect(out.size).toBe(3);
  });

  it("key places landmarks, the target, and depth-1 nodes only", () => {
    // Tier 0 is a landmark; node 2 is the target.
    const nodes: NodeFixture[] = [
      { x: -300, y: 0, tier: 0, depth: -1 },
      { x: -100, y: 0, tier: 3, depth: 1 },
      { x: 100, y: 0, tier: 3, depth: -1 },
      { x: 300, y: 0, tier: 3, depth: 2 },
    ];
    const { out } = place(nodes, { mode: "key" as LabelMode, selIdx: 2 });
    expect([...out.keys()].sort()).toEqual([0, 1, 2]);
  });

  it("auto places a node once camZoom crosses its tier's TIER_ZOOM threshold, and not before", () => {
    const nodes: NodeFixture[] = [{ x: 0, y: 0, tier: 1, depth: -1 }]; // TIER_ZOOM[1] === 1.0
    expect(place(nodes, { mode: "auto" as LabelMode, zoom: 0.9 }).out.size).toBe(0);
    expect(place(nodes, { mode: "auto" as LabelMode, zoom: 1.0 }).out.size).toBe(1);
  });
});

describe("createLabelPlacer / earning and focus", () => {
  it("the hovered/selected node always earns a label, at any zoom and any tier", () => {
    const nodes: NodeFixture[] = [{ x: 0, y: 0, tier: 3, depth: -1 }];
    expect(place(nodes, { mode: "auto" as LabelMode, zoom: 0.01, selIdx: 0 }).out.size).toBe(1);
    expect(place(nodes, { mode: "auto" as LabelMode, zoom: 0.01, hoverIdx: 0 }).out.size).toBe(1);
  });

  it("with something selected, a non-landmark node outside the neighbourhood is dropped", () => {
    const nodes: NodeFixture[] = [
      { x: 0, y: 0, tier: 3, depth: -1 },
      { x: 300, y: 0, tier: 3, depth: -1 },
    ];
    const { out } = place(nodes, { mode: "all" as LabelMode, selIdx: 0 });
    expect(out.has(1)).toBe(false);
  });

  it("a landmark outside the neighbourhood is kept while something else is focused, at reduced opacity", () => {
    const nodes: NodeFixture[] = [
      { x: 0, y: 0, tier: 3, depth: -1 },
      { x: 300, y: 0, tier: 0, depth: -1 },
    ];
    const { out } = place(nodes, { mode: "all" as LabelMode, selIdx: 0 });
    expect(out.get(1)?.[2]).toBeCloseTo(0.28);
  });
});

describe("createLabelPlacer / opacity tiers", () => {
  it("pins the four resting/focused opacity values", () => {
    const nodes: NodeFixture[] = [
      { x: 0, y: 0, tier: 3, depth: -1 },
      { x: 200, y: 0, tier: 3, depth: 1 },
      { x: -400, y: 0, tier: 0, depth: -1 },
      { x: -200, y: 0, tier: 3, depth: -1 },
    ];
    const resting = place([nodes[2]!, nodes[3]!], { mode: "all" as LabelMode });
    expect(resting.out.get(0)?.[2]).toBeCloseTo(0.82);
    expect(resting.out.get(1)?.[2]).toBeCloseTo(0.52);

    const focused = place([nodes[0]!, nodes[1]!], { mode: "all" as LabelMode, selIdx: 0 });
    expect(focused.out.get(0)?.[2]).toBeCloseTo(1);
    expect(focused.out.get(1)?.[2]).toBeCloseTo(0.92);
  });
});

describe("createLabelPlacer / collision and pool", () => {
  it("of two overlapping boxes, only the higher-scoring one is placed", () => {
    // Equal radii, so the glyph offset doesn't separate the boxes; only tier differs.
    const nodes: NodeFixture[] = [
      { x: 0, y: 0, radius: 0, tier: 3, depth: -1 },
      { x: 5, y: 0, radius: 0, tier: 0, depth: -1 },
    ];
    const { out } = place(nodes, { mode: "all" as LabelMode });
    expect(out.has(1)).toBe(true);
    expect(out.has(0)).toBe(false);
  });

  it("nudged one pixel apart, both are placed", () => {
    // Boxes are 17px wide (see STUB_MEASURE).
    const collide = place(
      [
        { x: 0, y: 0, radius: 0 },
        { x: 16, y: 0, radius: 0 },
      ],
      { mode: "all" as LabelMode },
    );
    expect(collide.out.size).toBe(1);

    const clear = place(
      [
        { x: 0, y: 0, radius: 0 },
        { x: 17, y: 0, radius: 0 },
      ],
      { mode: "all" as LabelMode },
    );
    expect(clear.out.size).toBe(2);
  });

  it("equal scores: the lower index wins the collision", () => {
    const nodes: NodeFixture[] = [
      { x: 0, y: 0, radius: 0 },
      { x: 5, y: 0, radius: 0 },
    ];
    const { out } = place(nodes, { mode: "all" as LabelMode });
    expect(out.has(0)).toBe(true);
    expect(out.has(1)).toBe(false);
  });

  it("with a pool of 3 and 10 earning candidates, exactly 3 are placed — the top 3 by score", () => {
    const nodes: NodeFixture[] = Array.from({ length: 10 }, (_, i) => ({
      x: i * 80 - 360,
      y: 0,
      radius: i, // score rises with index
    }));
    const { out } = place(nodes, { mode: "all" as LabelMode }, 3);
    expect(out.size).toBe(3);
    expect([...out.keys()].sort((first, second) => first - second)).toEqual([7, 8, 9]);
  });

  it("a node far off-screen is never placed, even as the top-scoring candidate", () => {
    const nodes: NodeFixture[] = [
      { x: 100000, y: 0, radius: 999 },
      { x: 0, y: 0, radius: 1 },
    ];
    const { out } = place(nodes, { mode: "all" as LabelMode });
    expect(out.has(0)).toBe(false);
    expect(out.has(1)).toBe(true);
  });
});
