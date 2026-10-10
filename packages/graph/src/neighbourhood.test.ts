import { describe, expect, it } from "vitest";
import {
  computeNeighbourhood,
  isolationSet,
  TIER_NEARBY,
  type NeighbourhoodGraph,
} from "./neighbourhood.js";

type Edge = [number, number];

function buildGraph(
  nodeCount: number,
  edges: Edge[],
  hiddenNodes: number[] = [],
): NeighbourhoodGraph {
  const edgeA = new Int32Array(edges.length),
    edgeB = new Int32Array(edges.length);
  const incidence: Array<Array<{ edge: number; other: number }>> = Array.from(
    { length: nodeCount },
    () => [],
  );
  edges.forEach(([a, b], edge) => {
    edgeA[edge] = a;
    edgeB[edge] = b;
    incidence[a].push({ edge, other: b });
    incidence[b].push({ edge, other: a });
  });
  const hidden = new Float32Array(nodeCount);
  for (const i of hiddenNodes) hidden[i] = 1;
  return { inc: incidence, eA: edgeA, eB: edgeB, hidden };
}

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
    const graph = buildGraph(3, [
      [0, 1],
      [1, 2],
    ]);
    const depth = new Float32Array(3),
      tier = new Float32Array(2);
    computeNeighbourhood(graph, 0, depth, tier);
    expect([...depth]).toEqual([0, 1, 2]);
  });

  it("hidden nodes are never given a depth, and block traversal through themselves", () => {
    const graph = buildGraph(
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
    computeNeighbourhood(graph, 0, depth, tier);
    expect(depth[0]).toBe(0);
    expect(depth[1]).toBe(-1);
    expect(depth[2]).toBe(-1);
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
    expect(tier[0]).toBe(1);
  });

  it("an edge joining two immediate neighbours gets TIER_NEARBY, not 0 (the regression this was extracted for)", () => {
    const graph = buildGraph(3, [
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
    const depth = new Float32Array(3),
      tier = new Float32Array(3);
    computeNeighbourhood(graph, 0, depth, tier);
    expect(depth[1]).toBe(1);
    expect(depth[2]).toBe(1);
    expect(tier[2]).toBeCloseTo(TIER_NEARBY); // Float32Array rounds 0.45
  });

  it("an edge with one endpoint outside the neighbourhood stays 0", () => {
    const depth = new Float32Array(6),
      tier = new Float32Array(5);
    computeNeighbourhood(CHAIN6, 0, depth, tier);
    expect(tier[3]).toBe(0);
  });

  it("never crosses a hidden edge, so nodes joined only by one aren't neighbours", () => {
    // 1—2 is hidden, so 2 is reached the long way, through 0 and 3.
    const graph = {
      ...buildGraph(4, [
        [0, 1],
        [1, 2],
        [0, 3],
        [3, 2],
      ]),
      edgeHidden: (edge: number) => edge === 1,
    };
    const depth = new Float32Array(4),
      tier = new Float32Array(4);
    computeNeighbourhood(graph, 1, depth, tier);
    expect([...depth]).toEqual([1, 0, 3, 2]);
    expect(tier[3]).toBe(0);
  });
});

describe("isolationSet", () => {
  it("keeps the node and everything one edge away, either end, and nothing when -1", () => {
    const edgeA = Int32Array.from([0, 1, 2, 4]),
      edgeB = Int32Array.from([1, 2, 3, 1]);
    expect([...isolationSet(1, edgeA, edgeB)!].sort()).toEqual([0, 1, 2, 4]);
    expect(isolationSet(-1, edgeA, edgeB)).toBeNull();
    expect([...isolationSet(5, edgeA, edgeB)!]).toEqual([5]);
  });
});
