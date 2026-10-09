/* ============================================================================
   VALIDATE

   Moved out of the top of GraphCanvas.tsx's `boot()`. Runs before anything
   that needs tearing down exists. An edge to an unknown node used to survive
   as index -1 until the adjacency build deep inside setup, where it died as
   an opaque TypeError with the renderer, canvas and label pool already live;
   a category id missing from the maps died the same way in the solver setup.

   Pure: no DOM, no WebGL, so every message is unit-testable.
   ========================================================================== */

import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

/** What to do with an edge whose endpoint id matches no node. */
export type InvalidEdgePolicy = "error" | "drop";

/** An edge left out under `invalidEdges: "drop"`, and why. */
export interface DroppedEdge {
  /** Index into the edges array the consumer passed. */
  index: number;
  edge: GraphEdge;
  /** Which endpoint matched no node. */
  end: "a" | "b";
}

export interface ValidatedGraph {
  /** Node id → dense index. */
  idToIndex: Map<unknown, number>;
  /** The edges that survived, in their original order. Every per-edge array below is parallel to this. */
  edges: readonly GraphEdge[];
  /** Edges left out under `invalidEdges: "drop"`. Always empty under `"error"`. */
  dropped: readonly DroppedEdge[];
  /** Per-edge dense index of endpoint `a`. */
  eA: Int32Array;
  /** Per-edge dense index of endpoint `b`. */
  eB: Int32Array;
}

/**
 * Checks ids and category references, and resolves edge endpoints to dense
 * indices. Throws an `Error` naming the first offending entry.
 *
 * With `invalidEdges: "drop"`, an edge whose endpoint matches no node is left
 * out and reported in `dropped` instead of throwing — for data that goes
 * stale between a node being removed and its edges catching up. Everything
 * else still throws: a duplicate id or a missing category is a bug in how the
 * graph was built, not a gap in the data.
 */
export function validateGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  nodeCategories: Readonly<Record<string, NodeCategory>>,
  linkCategories: Readonly<Record<string, LinkCategory>>,
  invalidEdges: InvalidEdgePolicy = "error",
): ValidatedGraph {
  const n = nodes.length;
  const show = (id: unknown) => JSON.stringify(id);
  const idToIndex = new Map<unknown, number>();
  for (let i = 0; i < n; i++) {
    const node = nodes[i]!;
    if (idToIndex.has(node.id))
      throw new Error(`GraphCanvas: nodes[${i}] duplicates id ${show(node.id)}`);
    if (nodeCategories[node.categoryId] === undefined) {
      throw new Error(
        `GraphCanvas: nodes[${i}] has categoryId ${show(node.categoryId)}, which is not in nodeCategories`,
      );
    }
    idToIndex.set(node.id, i);
  }
  const kept: GraphEdge[] = [];
  const dropped: DroppedEdge[] = [];
  const ends: number[] = [];
  for (let e = 0; e < edges.length; e++) {
    const edge = edges[e]!;
    const a = idToIndex.get(edge.a),
      b = idToIndex.get(edge.b);
    if (a === undefined || b === undefined) {
      const end = a === undefined ? "a" : "b";
      if (invalidEdges === "drop") {
        dropped.push({ index: e, edge, end });
        continue;
      }
      throw new Error(
        `GraphCanvas: edges[${e}].${end} references unknown node id ${show(end === "a" ? edge.a : edge.b)}`,
      );
    }
    if (linkCategories[edge.categoryId] === undefined) {
      throw new Error(
        `GraphCanvas: edges[${e}] has categoryId ${show(edge.categoryId)}, which is not in linkCategories`,
      );
    }
    kept.push(edge);
    ends.push(a, b);
  }
  const m = kept.length;
  const eA = new Int32Array(m),
    eB = new Int32Array(m);
  for (let e = 0; e < m; e++) {
    eA[e] = ends[e * 2]!;
    eB[e] = ends[e * 2 + 1]!;
  }
  return { idToIndex, edges: kept, dropped, eA, eB };
}
