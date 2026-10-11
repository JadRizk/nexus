import { describe, expect, it } from "vitest";
import {
  A_FRAY,
  A_HIDE,
  A_JIT,
  A_TIER,
  EDGE_END_TRIM,
  packBuffers,
  packEdges,
  packNodes,
} from "./buffers.js";
import type { PackEdgesInput } from "./buffers.js";
import { DEFAULT_ARC_BOW, encodeGain } from "./shaders.js";
import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

const NODE_CATEGORY: NodeCategory = {
  label: "NODE",
  shape: 2,
  color: "#ff0000",
  code: "ND",
  size: 4,
  charge: 1,
  mass: 1,
  tier: 3,
};
const LINK_CATEGORY: LinkCategory = {
  label: "LINK",
  color: "#0000ff",
  width: 1.5,
  dist: 1,
  strength: 1,
};
const nodeCategories = { n: NODE_CATEGORY };
const ARC: LinkCategory = { ...LINK_CATEGORY, routing: "arc", curve: 0.3 };

const node = (id: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  label: id,
  categoryId: "n",
  ...extra,
});
const edge = (extra: Partial<GraphEdge> = {}): GraphEdge => ({
  a: "a",
  b: "b",
  categoryId: "l",
  ...extra,
});

/** A counter standing in for the random stream, so each draw is identifiable. */
const counter = (): (() => number) => {
  let draws = 0;
  return () => ++draws / 100;
};

const packNodesOf = (nodes: GraphNode[], degree: number[]) =>
  packNodes({
    nodes,
    nodeCategories,
    nodeCategoryIds: nodes.map((each) => each.categoryId),
    degree: Uint16Array.from(degree),
    visualRandom: counter(),
  });

const packEdgesOf = (
  edges: GraphEdge[],
  category: LinkCategory = LINK_CATEGORY,
  extra: Partial<PackEdgesInput> = {},
) =>
  packEdges({
    liveEdges: edges,
    linkCategories: { l: category },
    edgeCategoryIds: edges.map((each) => each.categoryId),
    edgeEndA: new Int32Array(edges.length),
    edgeEndB: new Int32Array(edges.length).fill(1),
    nodeRadii: Float32Array.from([2, 3]),
    visualRandom: counter(),
    ...extra,
  });

// Slot k of edge e in a 4-wide attribute.
const slot = (values: Float32Array, e: number, k: number) => values[e * 4 + k];

describe("packNodes", () => {
  it("uses the category size for a node with no edges", () => {
    expect(packNodesOf([node("a")], [0]).nodeRadii[0]).toBe(4);
  });

  it("grows the radius with degree, by at most 2.4×", () => {
    const { nodeRadii } = packNodesOf([node("a"), node("b")], [3, 65535]);
    expect(nodeRadii[0]).toBeCloseTo(4 * (1 + Math.log2(4) * 0.16));
    expect(nodeRadii[1]).toBeCloseTo(4 * 2.4);
  });

  it("lets a node's own size override its category's", () => {
    expect(packNodesOf([node("a", { size: 10 })], [0]).nodeRadii[0]).toBe(10);
  });

  it("copies the category's shape", () => {
    expect(packNodesOf([node("a")], [0]).nodeShapes[0]).toBe(2);
  });

  it("copies the category's tier", () => {
    expect(packNodesOf([node("a")], [0]).nodeTiers[0]).toBe(3);
  });

  it("copies the category's colour", () => {
    expect([...packNodesOf([node("a")], [0]).nodeColors]).toEqual([1, 0, 0]);
  });

  it("looks each node's category up by id, not by position", () => {
    // Listed in the opposite order to the nodes that use them.
    const packed = packNodes({
      nodes: [node("a", { categoryId: "second" }), node("b", { categoryId: "first" })],
      nodeCategories: {
        first: { ...NODE_CATEGORY, shape: 1, tier: 1, color: "#00ff00", size: 5 },
        second: { ...NODE_CATEGORY, shape: 4, tier: 2, color: "#0000ff", size: 7 },
      },
      nodeCategoryIds: ["second", "first"],
      degree: Uint16Array.from([0, 0]),
      visualRandom: counter(),
    });
    expect([...packed.nodeShapes]).toEqual([4, 1]);
    expect([...packed.nodeTiers]).toEqual([2, 1]);
    expect([...packed.nodeRadii]).toEqual([7, 5]);
    expect([...packed.nodeColors]).toEqual([0, 0, 1, 0, 1, 0]);
  });

  it("draws one seed per node, in order", () => {
    expect([...packNodesOf([node("a"), node("b")], [0, 0]).nodeSeeds]).toEqual(
      [0.01, 0.02].map((draw) => Math.fround(draw)),
    );
  });

  it("starts every node with no depth", () => {
    expect([...packNodesOf([node("a")], [0]).nodeDepths]).toEqual([-1]);
  });
});

describe("packEdges", () => {
  it("encodes no absent end as fray 0", () => {
    expect(slot(packEdgesOf([edge()]).edgeParams2, 0, A_FRAY)).toBe(0);
  });

  it("encodes an absent b end as fray 1", () => {
    expect(slot(packEdgesOf([edge({ absentEnd: "b" })]).edgeParams2, 0, A_FRAY)).toBe(1);
  });

  it("encodes an absent a end as fray 2", () => {
    expect(slot(packEdgesOf([edge({ absentEnd: "a" })]).edgeParams2, 0, A_FRAY)).toBe(2);
  });

  it("alternates the arc's bow sign from one edge to the next", () => {
    const { edgeParams0 } = packEdgesOf([edge(), edge(), edge()], ARC);
    expect([0, 1, 2].map((e) => slot(edgeParams0, e, 1))).toEqual(
      [0.3, -0.3, 0.3].map((bow) => Math.fround(bow)),
    );
  });

  it("bows an arc with no curve by the default", () => {
    const { edgeParams0 } = packEdgesOf([edge()], { ...LINK_CATEGORY, routing: "arc" });
    expect(slot(edgeParams0, 0, 1)).toBe(Math.fround(DEFAULT_ARC_BOW));
  });

  it("defaults gain to 1, directed", () => {
    expect(slot(packEdgesOf([edge()]).edgeParams0, 0, 3)).toBe(encodeGain(1, true));
  });

  it("encodes the category's gain and direction", () => {
    const { edgeParams0 } = packEdgesOf([edge()], { ...LINK_CATEGORY, gain: 2, directed: false });
    expect(slot(edgeParams0, 0, 3)).toBe(encodeGain(2, false));
  });

  it("defaults dash, flow and jitter to 0", () => {
    const packed = packEdgesOf([edge()]);
    expect(slot(packed.edgeParams0, 0, 2)).toBe(0);
    expect(slot(packed.edgeParams1, 0, 0)).toBe(0);
    expect(slot(packed.edgeParams2, 0, A_JIT)).toBe(0);
  });

  it("stops edges 1.15 node radii short of each centre", () => {
    const { edgeParams1 } = packEdgesOf([edge()]);
    expect(slot(edgeParams1, 0, 2)).toBe(Math.fround(2 * 1.15));
    expect(slot(edgeParams1, 0, 3)).toBe(Math.fround(3 * 1.15));
  });

  it("lays out the iP2 slots as tier, hide, jit, fray", () => {
    expect([A_TIER, A_HIDE, A_JIT, A_FRAY]).toEqual([0, 1, 2, 3]);
  });

  it("trims each end by its node's radius", () => {
    const { edgeParams1 } = packEdgesOf([edge()]);
    expect(slot(edgeParams1, 0, 2)).toBe(Math.fround(2 * EDGE_END_TRIM));
    expect(slot(edgeParams1, 0, 3)).toBe(Math.fround(3 * EDGE_END_TRIM));
  });

  it("copies the category's width and colour", () => {
    const packed = packEdgesOf([edge()]);
    expect(slot(packed.edgeParams0, 0, 0)).toBe(1.5);
    expect([...packed.edgeColors]).toEqual([0, 0, 1]);
  });
});

describe("packBuffers", () => {
  it("draws every node seed before any edge seed", () => {
    const packed = packBuffers({
      nodes: [node("a"), node("b")],
      nodeCategories,
      nodeCategoryIds: ["n", "n"],
      degree: Uint16Array.from([1, 1]),
      liveEdges: [edge()],
      linkCategories: { l: LINK_CATEGORY },
      edgeCategoryIds: ["l"],
      edgeEndA: Int32Array.from([0]),
      edgeEndB: Int32Array.from([1]),
      visualRandom: counter(),
    });
    expect([...packed.nodeSeeds]).toEqual([0.01, 0.02].map((draw) => Math.fround(draw)));
    expect(slot(packed.edgeParams1, 0, 1)).toBe(Math.fround(0.03));
  });
});
