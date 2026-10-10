import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

/** What to do with an edge whose endpoint id matches no node. */
export type InvalidEdgePolicy = "error" | "drop";

/** An edge left out under `invalidEdges: "drop"`, and why. */
export interface DroppedEdge {
  /** Index in the consumer's `edges` array. */
  index: number;
  edge: GraphEdge;
  /** Which endpoint matched no node. */
  end: "a" | "b";
}

export interface ValidatedGraph {
  idToIndex: Map<unknown, number>;
  /** Surviving edges, in order; the per-edge arrays below are parallel to this. */
  edges: readonly GraphEdge[];
  /** Always empty under `"error"`. */
  dropped: readonly DroppedEdge[];
  /** Dense node index of each edge's `a`; `eB` likewise for `b`. */
  eA: Int32Array;
  eB: Int32Array;
}

/** Resolves edge endpoints to dense indices; throws naming the first bad entry. `"drop"` relaxes only unknown endpoints. */
export function validateGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  nodeCategories: Readonly<Record<string, NodeCategory>>,
  linkCategories: Readonly<Record<string, LinkCategory>>,
  invalidEdges: InvalidEdgePolicy = "error",
): ValidatedGraph {
  const nodeCount = nodes.length;
  const show = (id: unknown) => JSON.stringify(id);
  const idToIndex = new Map<unknown, number>();
  for (let i = 0; i < nodeCount; i++) {
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
    const indexA = idToIndex.get(edge.a),
      indexB = idToIndex.get(edge.b);
    if (indexA === undefined || indexB === undefined) {
      const end = indexA === undefined ? "a" : "b";
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
    ends.push(indexA, indexB);
  }
  const keptCount = kept.length;
  const endpointsA = new Int32Array(keptCount),
    endpointsB = new Int32Array(keptCount);
  for (let e = 0; e < keptCount; e++) {
    endpointsA[e] = ends[e * 2]!;
    endpointsB[e] = ends[e * 2 + 1]!;
  }
  return { idToIndex, edges: kept, dropped, eA: endpointsA, eB: endpointsB };
}
