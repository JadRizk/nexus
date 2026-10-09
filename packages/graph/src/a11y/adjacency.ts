/* ============================================================================
   ADJACENCY — ranked connections per node

   The structure keyboard and screen-reader navigation walks. Built once per
   graph, in dense-index space; visibility (hidden categories, isolation) is
   applied when a list is read, not baked in, so filtering never rebuilds it.

   Ranked so the most important connection comes first: QUARTZ (ASSETS '26)
   found readers needed the strongest relationships announced first, not in
   whatever order the data listed them. The default rank is the category's
   weight (gain × strength), then the order categories were declared in, then
   the far node's label — so the order is stable and explainable.
   ========================================================================== */

import type { LinkCategory } from "../types.js";

export type ConnectionDirection = "out" | "in" | "both";

/** One end of an edge, seen from a node. Indices are dense (array positions), not ids. */
export interface NavConnection {
  /** Index of the edge. */
  edge: number;
  /** Index of the node at the other end. */
  other: number;
  categoryId: string;
  /** "out" when this node is the edge's `a`, "in" when it is `b`, "both" for an undirected category. */
  direction: ConnectionDirection;
  /** True when this node is the edge's `a` end, whether or not the category has a direction. */
  out: boolean;
  /** The category's weight: |gain| × strength. */
  strength: number;
}

/** Comparator for ranking a node's connections, most important first. */
export type RankConnections = (a: NavConnection, b: NavConnection) => number;

/** Which connections a direction filter keeps. Undirected connections count both ways. */
export type DirectionFilter = "all" | "out" | "in";

/**
 * The default ranking: weight, then category declaration order, then the far
 * node's label. Labels are compared with localeCompare for a human order.
 */
export function defaultRank(
  labels: ReadonlyArray<string>,
  categoryOrder: ReadonlyArray<string>,
): RankConnections {
  const order = new Map(categoryOrder.map((id, i) => [id, i]));
  return (a, b) =>
    b.strength - a.strength ||
    (order.get(a.categoryId) ?? 0) - (order.get(b.categoryId) ?? 0) ||
    labels[a.other]!.localeCompare(labels[b.other]!);
}

/** Every node's connections, ranked. A self-loop appears once. */
export function buildConnections(
  nodeCount: number,
  eA: Int32Array,
  eB: Int32Array,
  eCategoryId: ReadonlyArray<string>,
  linkCategories: Readonly<Record<string, LinkCategory>>,
  rank: RankConnections,
): NavConnection[][] {
  const lists: NavConnection[][] = Array.from({ length: nodeCount }, () => []);
  for (let e = 0; e < eA.length; e++) {
    const a = eA[e]!,
      b = eB[e]!;
    const categoryId = eCategoryId[e]!;
    const cat = linkCategories[categoryId]!;
    const directed = cat.directed ?? true;
    const strength = Math.abs(cat.gain ?? 1) * cat.strength;
    lists[a]!.push({
      edge: e,
      other: b,
      categoryId,
      direction: directed ? "out" : "both",
      out: true,
      strength,
    });
    if (a !== b)
      lists[b]!.push({
        edge: e,
        other: a,
        categoryId,
        direction: directed ? "in" : "both",
        out: false,
        strength,
      });
  }
  for (const list of lists) list.sort(rank);
  return lists;
}

/** A node's navigable connections: the far node and the edge both visible, and the direction kept by `filter`. */
export function visibleConnections(
  list: ReadonlyArray<NavConnection>,
  isNodeVisible: (i: number) => boolean,
  isEdgeVisible: (e: number) => boolean,
  filter: DirectionFilter,
): NavConnection[] {
  return list.filter(
    (c) =>
      isNodeVisible(c.other) &&
      isEdgeVisible(c.edge) &&
      (filter === "all" || c.direction === filter || c.direction === "both"),
  );
}
