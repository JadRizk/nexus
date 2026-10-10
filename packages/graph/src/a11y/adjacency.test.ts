import { describe, expect, it } from "vitest";
import { buildConnections, defaultRank, visibleConnections } from "./adjacency.js";
import type { LinkCategory } from "../types.js";

const linkCategory = (overrides: Partial<LinkCategory> = {}): LinkCategory => ({
  label: "L",
  color: "#fff",
  width: 1,
  dist: 1,
  strength: 1,
  ...overrides,
});

const labels = ["hub", "alpha", "beta", "gamma"];
const linkCategories = {
  weak: linkCategory({ strength: 0.5 }),
  strong: linkCategory({ strength: 1, gain: 1.5 }),
  pair: linkCategory({ strength: 1, directed: false }),
};
const order = Object.keys(linkCategories);
// hub -> beta (weak), gamma -> hub (strong), hub -- alpha (pair), hub -> gamma (weak)
const edgeA = Int32Array.from([0, 3, 0, 0]);
const edgeB = Int32Array.from([2, 0, 1, 3]);
const edgeCategoryIds = ["weak", "strong", "pair", "weak"];

describe("buildConnections", () => {
  const lists = buildConnections(
    4,
    edgeA,
    edgeB,
    edgeCategoryIds,
    linkCategories,
    defaultRank(labels, order),
  );

  it("ranks by weight (|gain| × strength), then category order, then far label", () => {
    expect(
      lists[0]!.map((connection) => [labels[connection.other], connection.categoryId]),
    ).toEqual([
      ["gamma", "strong"],
      ["alpha", "pair"],
      ["beta", "weak"],
      ["gamma", "weak"],
    ]);
  });

  it("records direction from each end, and both for an undirected category", () => {
    const hub = lists[0]!;
    expect(hub.find((connection) => connection.edge === 0)!.direction).toBe("out");
    expect(hub.find((connection) => connection.edge === 1)!.direction).toBe("in");
    expect(hub.find((connection) => connection.edge === 2)!.direction).toBe("both");
    expect(lists[2]![0]!.direction).toBe("in");
    expect(lists[1]![0]!.direction).toBe("both");
  });

  it("lists a self-loop once", () => {
    const loops = buildConnections(
      1,
      Int32Array.from([0]),
      Int32Array.from([0]),
      ["weak"],
      linkCategories,
      defaultRank(["solo"], order),
    );
    expect(loops[0]).toHaveLength(1);
  });
});

describe("visibleConnections", () => {
  const lists = buildConnections(
    4,
    edgeA,
    edgeB,
    edgeCategoryIds,
    linkCategories,
    defaultRank(labels, order),
  );
  const all = () => true;

  it("drops connections to hidden nodes and along hidden edges", () => {
    const visible = visibleConnections(
      lists[0]!,
      (node) => node !== 1,
      (edge) => edge !== 3,
      "all",
    );
    expect(visible.map((connection) => connection.edge)).toEqual([1, 0]);
  });

  it("keeps undirected connections under either direction filter", () => {
    expect(
      visibleConnections(lists[0]!, all, all, "out").map((connection) => connection.edge),
    ).toEqual([2, 0, 3]);
    expect(
      visibleConnections(lists[0]!, all, all, "in").map((connection) => connection.edge),
    ).toEqual([1, 2]);
  });
});
