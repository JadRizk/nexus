import { describe, expect, it } from "vitest";
import { validateGraph } from "./validate.js";
import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

const NODE_CAT: NodeCategory = {
  label: "NODE",
  shape: 0,
  color: "#ffffff",
  code: "ND",
  size: 4,
  charge: 1,
  mass: 1,
  tier: 1,
};
const LINK_CAT: LinkCategory = { label: "LINK", color: "#ffffff", width: 1, dist: 1, strength: 1 };
const nodeCategories = { n: NODE_CAT };
const linkCategories = { l: LINK_CAT };

const node = (id: string, categoryId = "n"): GraphNode => ({ id, label: id, categoryId });
const edge = (a: string, b: string, categoryId = "l"): GraphEdge => ({ a, b, categoryId });

describe("validateGraph", () => {
  it("resolves ids to dense indices and edge endpoints to those indices", () => {
    const v = validateGraph(
      [node("x"), node("y"), node("z")],
      [edge("x", "z"), edge("z", "y")],
      nodeCategories,
      linkCategories,
    );
    expect([...v.idToIndex.entries()]).toEqual([
      ["x", 0],
      ["y", 1],
      ["z", 2],
    ]);
    expect([...v.eA]).toEqual([0, 2]);
    expect([...v.eB]).toEqual([2, 1]);
  });

  it("accepts an empty graph", () => {
    const v = validateGraph([], [], nodeCategories, linkCategories);
    expect(v.idToIndex.size).toBe(0);
    expect(v.eA.length).toBe(0);
  });

  it.each([
    [
      "a duplicate node id",
      [node("a"), node("b"), node("a")],
      [],
      'GraphCanvas: nodes[2] duplicates id "a"',
    ],
    [
      "a node category missing from nodeCategories",
      [node("a", "ghost")],
      [],
      'GraphCanvas: nodes[0] has categoryId "ghost", which is not in nodeCategories',
    ],
    [
      "an edge whose a end matches no node",
      [node("a")],
      [edge("zzz", "a")],
      'GraphCanvas: edges[0].a references unknown node id "zzz"',
    ],
    [
      "an edge whose b end matches no node",
      [node("a")],
      [edge("a", "zzz")],
      'GraphCanvas: edges[0].b references unknown node id "zzz"',
    ],
    [
      "a link category missing from linkCategories",
      [node("a"), node("b")],
      [edge("a", "b"), edge("b", "a", "nope")],
      'GraphCanvas: edges[1] has categoryId "nope", which is not in linkCategories',
    ],
  ])("throws a named error for %s", (_, nodes, edges, message) => {
    expect(() => validateGraph(nodes, edges, nodeCategories, linkCategories)).toThrow(
      new Error(message),
    );
  });

  describe('invalidEdges: "drop"', () => {
    const nodes = [node("x"), node("y"), node("z")];
    const edges = [edge("x", "y"), edge("x", "gone"), edge("ghost", "z"), edge("y", "z")];

    it("leaves out edges with an unknown endpoint, keeps the rest in order, and reports which end", () => {
      const v = validateGraph(nodes, edges, nodeCategories, linkCategories, "drop");
      expect(v.edges).toEqual([edges[0], edges[3]]);
      expect([...v.eA]).toEqual([0, 1]);
      expect([...v.eB]).toEqual([1, 2]);
      expect(v.dropped).toEqual([
        { index: 1, edge: edges[1], end: "b" },
        { index: 2, edge: edges[2], end: "a" },
      ]);
    });

    it("still throws for a missing link category on an edge it keeps", () => {
      expect(() =>
        validateGraph(nodes, [edge("x", "y", "nope")], nodeCategories, linkCategories, "drop"),
      ).toThrow(/edges\[0\] has categoryId "nope"/);
    });

    it("still throws for a duplicate node id", () => {
      expect(() =>
        validateGraph([node("x"), node("x")], [], nodeCategories, linkCategories, "drop"),
      ).toThrow(/duplicates id "x"/);
    });

    it("drops nothing and reports nothing under the default policy", () => {
      const v = validateGraph(nodes, [edges[0]!], nodeCategories, linkCategories);
      expect(v.dropped).toEqual([]);
      expect(v.edges).toEqual([edges[0]]);
    });
  });
});
