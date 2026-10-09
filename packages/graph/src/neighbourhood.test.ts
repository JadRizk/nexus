import { describe, expect, it } from "vitest";
import {
  computeNeighbourhood,
  isolationSet,
  TIER_NEARBY,
  type NeighbourhoodGraph,
} from "./neighbourhood.js";

type Edge = [number, number];

/** Builds `inc`/`eA`/`eB` for an undirected graph from a plain edge list. */
function buildGraph(n: number, edges: Edge[], hiddenIdx: number[] = []): NeighbourhoodGraph {
  const m = edges.length;
  const eA = new Int32Array(m),
    eB = new Int32Array(m);
  const inc: Array<Array<{ edge: number; other: number }>> = Array.from({ length: n }, () => []);
  edges.forEach(([a, b], e) => {
    eA[e] = a;
    eB[e] = b;
    inc[a]!.push({ edge: e, other: b });
    inc[b]!.push({ edge: e, other: a });
  });
  const hidden = new Float32Array(n);
  for (const i of hiddenIdx) hidden[i] = 1;
  return { inc, eA, eB, hidden };
}

// 0—1—2—3—4—5, a plain chain. depth from 0: 0,1,2,3,-1,-1 (walk stops at depth 3).
const CHAIN6 = buildGraph(6, [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
]);

describe("computeNeighbourhood", () => {
  it("idx < 0 clears both arrays", () => {
    const depth = new Float32Array(6).fill(9),
      tier = new Float32Array(5).fill(9);
    computeNeighbourhood(CHAIN6, -1, depth, tier);
    expect([...depth]).toEqual([-1, -1, -1, -1, -1, -1]);
    expect([...tier]).toEqual([0, 0, 0, 0, 0]);
  });

  it("depth is graph distance: a two-hop chain gives 0, 1, 2", () => {
    const g = buildGraph(3, [
      [0, 1],
      [1, 2],
    ]);
    const depth = new Float32Array(3),
      tier = new Float32Array(2);
    computeNeighbourhood(g, 0, depth, tier);
    expect([...depth]).toEqual([0, 1, 2]);
  });

  it("hidden nodes are never given a depth, and block traversal through themselves", () => {
    // 0—1—2—3, node 1 hidden. Node 2 is reachable only via node 1.
    const g = buildGraph(
      4,
      [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
      [1],
    );
    const depth = new Float32Array(4),
      tier = new Float32Array(3);
    computeNeighbourhood(g, 0, depth, tier);
    expect(depth[0]).toBe(0);
    expect(depth[1]).toBe(-1); // hidden: never visited
    expect(depth[2]).toBe(-1); // only reachable via the hidden node
    expect(depth[3]).toBe(-1);
  });

  it("the walk stops at depth 3; a node five hops out stays -1", () => {
    const depth = new Float32Array(6),
      tier = new Float32Array(5);
    computeNeighbourhood(CHAIN6, 0, depth, tier);
    expect([...depth]).toEqual([0, 1, 2, 3, -1, -1]);
  });

  it("incident edges get exactly 1", () => {
    const depth = new Float32Array(6),
      tier = new Float32Array(5);
    computeNeighbourhood(CHAIN6, 0, depth, tier);
    expect(tier[0]).toBe(1); // edge (0,1), incident to idx
  });

  it("an edge joining two immediate neighbours gets TIER_NEARBY, not 0 (the regression this was extracted for)", () => {
    // 0 connects to 1 and 2; 1—2 is not incident to 0, but both ends are depth 1.
    const g = buildGraph(3, [
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
    const depth = new Float32Array(3),
      tier = new Float32Array(3);
    computeNeighbourhood(g, 0, depth, tier);
    expect(depth[1]).toBe(1);
    expect(depth[2]).toBe(1);
    expect(tier[2]).toBeCloseTo(TIER_NEARBY); // edge (1,2) — Float32Array rounds 0.45, so not exact equality
  });

  it("an edge with one endpoint outside the neighbourhood stays 0", () => {
    const depth = new Float32Array(6),
      tier = new Float32Array(5);
    computeNeighbourhood(CHAIN6, 0, depth, tier);
    // edge (3,4): node 3 is reached (depth 3), node 4 is not (-1).
    expect(tier[3]).toBe(0);
  });

  it("never crosses a hidden edge, so nodes joined only by one aren't neighbours", () => {
    // 0—1 visible, 1—2 hidden, 0—3—2 visible: 2 is still reached, the long way.
    const g = {
      ...buildGraph(4, [
        [0, 1],
        [1, 2],
        [0, 3],
        [3, 2],
      ]),
      edgeHidden: (e: number) => e === 1,
    };
    const depth = new Float32Array(4),
      tier = new Float32Array(4);
    computeNeighbourhood(g, 1, depth, tier);
    // From 1: 0 at 1 hop, 3 at 2, and 2 at 3 — not 1, across the hidden edge.
    expect([...depth]).toEqual([1, 0, 3, 2]);
    // Edge (3,2) reaches depth 3, outside NEARBY_DEPTH, so it stays unrelated.
    expect(tier[3]).toBe(0);
  });
});

describe("isolationSet", () => {
  it("keeps the node and everything one edge away, either end, and nothing when -1", () => {
    // 0—1—2—3, plus 4—1: isolating 1 keeps 0, 1, 2 and 4, not 3.
    const eA = Int32Array.from([0, 1, 2, 4]),
      eB = Int32Array.from([1, 2, 3, 1]);
    expect([...isolationSet(1, eA, eB)!].sort()).toEqual([0, 1, 2, 4]);
    expect(isolationSet(-1, eA, eB)).toBeNull();
    // A node with no edges keeps only itself.
    expect([...isolationSet(5, eA, eB)!]).toEqual([5]);
  });
});
