import { describe, expect, it } from "vitest";
import { buildPhysicsGraph, prepareGraph } from "./prepare.js";
import { seedFromIds } from "./random.js";
import { ORPHAN_STATE } from "./types.js";
import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

const NODE_CATEGORY: NodeCategory = {
  label: "NODE",
  shape: 0,
  color: "#ffffff",
  code: "ND",
  size: 4,
  charge: 2,
  mass: 3,
  tier: 1,
};
const LINK_CATEGORY: LinkCategory = {
  label: "LINK",
  color: "#ffffff",
  width: 1,
  dist: 5,
  strength: 0.5,
};
const nodeCategories = {
  n: NODE_CATEGORY,
  placed: { ...NODE_CATEGORY, sectorAngle: 1, radiusTarget: 9 },
};
const linkCategories = { l: LINK_CATEGORY, other: { ...LINK_CATEGORY, dist: 7 } };

const node = (id: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  label: id,
  categoryId: "n",
  ...extra,
});
const edge = (a: string, b: string, categoryId = "l"): GraphEdge => ({ a, b, categoryId });

const prepare = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  extra: { seed?: number | null; invalidEdges?: "error" | "drop" } = {},
) => prepareGraph({ nodes, edges, nodeCategories, linkCategories, ...extra });

describe("prepareGraph", () => {
  it("shows a node with no live edge as orphan, whatever its declared state", () => {
    const prepared = prepare([node("a", { state: 2 }), node("b"), node("c")], [edge("a", "b")]);
    expect(prepared.nodeStates[2]).toBe(ORPHAN_STATE);
  });

  it("keeps a connected node's declared state", () => {
    const prepared = prepare([node("a", { state: 2 }), node("b")], [edge("a", "b")]);
    expect(prepared.nodeStates[0]).toBe(2);
  });

  it("shows a connected node with no declared state as stable", () => {
    const prepared = prepare([node("a"), node("b")], [edge("a", "b")]);
    expect(prepared.nodeStates[1]).toBe(1);
  });

  it("counts the live edges touching each node", () => {
    const prepared = prepare([node("a"), node("b"), node("c")], [edge("a", "b"), edge("b", "c")]);
    expect([...prepared.degree]).toEqual([1, 2, 1]);
  });

  it("uses an explicit seed as the layout seed", () => {
    expect(prepare([node("a")], [], { seed: 42 }).layoutSeed).toBe(42);
  });

  it("derives the layout seed from the node ids when the seed is omitted", () => {
    expect(prepare([node("b"), node("a")], []).layoutSeed).toBe(seedFromIds(["a", "b"]));
  });

  it("leaves the layout unseeded when the seed is null", () => {
    expect(prepare([node("a")], [], { seed: null }).layoutSeed).toBeUndefined();
  });

  it("drops an edge to an unknown node under the drop policy and reports it", () => {
    const prepared = prepare([node("a"), node("b")], [edge("a", "ghost"), edge("a", "b")], {
      invalidEdges: "drop",
    });
    expect(prepared.liveEdges.map((live) => live.b)).toEqual(["b"]);
    expect(prepared.dropped.map((dropped) => dropped.index)).toEqual([0]);
  });

  it("leaves dropped edges out of the degree and the per-edge arrays", () => {
    const prepared = prepare([node("a"), node("b")], [edge("a", "ghost", "other")], {
      invalidEdges: "drop",
    });
    expect(prepared.edgeCount).toBe(0);
    expect(prepared.edgeCategoryIds).toEqual([]);
    expect(prepared.nodeStates[0]).toBe(ORPHAN_STATE);
  });

  it("throws on an edge to an unknown node by default", () => {
    expect(() => prepare([node("a")], [edge("a", "ghost")])).toThrow(/unknown node id "ghost"/);
  });

  it("resolves live edge endpoints to dense node indices", () => {
    const prepared = prepare([node("a"), node("b"), node("c")], [edge("c", "a")]);
    expect([...prepared.edgeEndA, ...prepared.edgeEndB]).toEqual([2, 0]);
  });
});

describe("buildPhysicsGraph", () => {
  const build = (nodes: GraphNode[], edgeCategoryIds: string[], ends: [number, number][]) =>
    buildPhysicsGraph({
      nodes,
      nodeCategories,
      linkCategories,
      edgeCategoryIds,
      edgeEndA: Int32Array.from(ends, ([a]) => a),
      edgeEndB: Int32Array.from(ends, ([, b]) => b),
    });

  it("omits sectorAngle and radiusTarget when neither node nor category sets them", () => {
    expect(build([node("a")], [], []).nodes).toEqual([{ charge: 2, mass: 3 }]);
  });

  it("falls back to the category's sectorAngle and radiusTarget", () => {
    const [physicsNode] = build([node("a", { categoryId: "placed" })], [], []).nodes;
    expect(physicsNode).toEqual({ charge: 2, mass: 3, sectorAngle: 1, radiusTarget: 9 });
  });

  it("lets a node's own sectorAngle and radiusTarget override its category's", () => {
    const overriding = node("a", { categoryId: "placed", sectorAngle: 0.5, radiusTarget: 3 });
    const [physicsNode] = build([overriding], [], []).nodes;
    expect(physicsNode).toMatchObject({ sectorAngle: 0.5, radiusTarget: 3 });
  });

  it("gives each edge its endpoints and its category's distance and strength", () => {
    const graph = build([node("a"), node("b")], ["other"], [[1, 0]]);
    expect(graph.edges).toEqual([{ a: 1, b: 0, dist: 7, strength: 0.5 }]);
  });
});
