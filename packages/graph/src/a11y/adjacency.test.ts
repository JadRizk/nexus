import { describe, expect, it } from "vitest";
import { buildConnections, defaultRank, visibleConnections } from "./adjacency.js";
import type { LinkCategory } from "../types.js";

const cat = (over: Partial<LinkCategory> = {}): LinkCategory => ({
  label: "L",
  color: "#fff",
  width: 1,
  dist: 1,
  strength: 1,
  ...over,
});

// 0:hub  1:alpha  2:beta  3:gamma
const labels = ["hub", "alpha", "beta", "gamma"];
const linkCategories = {
  weak: cat({ strength: 0.5 }),
  strong: cat({ strength: 1, gain: 1.5 }),
  pair: cat({ strength: 1, directed: false }),
};
const order = Object.keys(linkCategories);
// hub -> beta (weak), gamma -> hub (strong), hub -- alpha (pair), hub -> gamma (weak)
const eA = Int32Array.from([0, 3, 0, 0]);
const eB = Int32Array.from([2, 0, 1, 3]);
const eCat = ["weak", "strong", "pair", "weak"];

describe("buildConnections", () => {
  const lists = buildConnections(4, eA, eB, eCat, linkCategories, defaultRank(labels, order));

  it("ranks by weight (|gain| × strength), then category order, then far label", () => {
    expect(lists[0]!.map((c) => [labels[c.other], c.categoryId])).toEqual([
      ["gamma", "strong"], // 1.5
      ["alpha", "pair"], // 1.0
      ["beta", "weak"], // 0.5, beta before gamma
      ["gamma", "weak"],
    ]);
  });

  it("records direction from each end, and both for an undirected category", () => {
    const hub = lists[0]!;
    expect(hub.find((c) => c.edge === 0)!.direction).toBe("out");
    expect(hub.find((c) => c.edge === 1)!.direction).toBe("in");
    expect(hub.find((c) => c.edge === 2)!.direction).toBe("both");
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
  const lists = buildConnections(4, eA, eB, eCat, linkCategories, defaultRank(labels, order));
  const all = () => true;

  it("drops connections to hidden nodes and along hidden edges", () => {
    const v = visibleConnections(
      lists[0]!,
      (i) => i !== 1,
      (e) => e !== 3,
      "all",
    );
    expect(v.map((c) => c.edge)).toEqual([1, 0]);
  });

  it("keeps undirected connections under either direction filter", () => {
    expect(visibleConnections(lists[0]!, all, all, "out").map((c) => c.edge)).toEqual([2, 0, 3]);
    expect(visibleConnections(lists[0]!, all, all, "in").map((c) => c.edge)).toEqual([1, 2]);
  });
});
