import type { LinkCategory } from "../types.js";

export type ConnectionDirection = "out" | "in" | "both";

/** One end of an edge, seen from a node. Indices are dense array positions, not ids. */
export interface NavConnection {
  edge: number;
  other: number;
  categoryId: string;
  /** "out" when this node is the edge's `a`, "in" when it is `b`, "both" for an undirected category. */
  direction: ConnectionDirection;
  /** True when this node is the edge's `a` end, whether or not the category has a direction. */
  out: boolean;
  /** |gain| × strength. */
  strength: number;
}

export type RankConnections = (a: NavConnection, b: NavConnection) => number;

/** Undirected connections pass every filter. */
export type DirectionFilter = "all" | "out" | "in";

/** Weight, then category declaration order, then the far node's label by localeCompare. */
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

/** Every node's connections, ranked; a self-loop appears once. Visibility is applied on read, so filtering never rebuilds it. */
export function buildConnections(
  nodeCount: number,
  eA: Int32Array,
  eB: Int32Array,
  edgeCategoryIds: ReadonlyArray<string>,
  linkCategories: Readonly<Record<string, LinkCategory>>,
  rank: RankConnections,
): NavConnection[][] {
  const lists: NavConnection[][] = Array.from({ length: nodeCount }, () => []);
  for (let e = 0; e < eA.length; e++) {
    const a = eA[e]!,
      b = eB[e]!;
    const categoryId = edgeCategoryIds[e]!;
    const category = linkCategories[categoryId]!;
    const directed = category.directed ?? true;
    const strength = Math.abs(category.gain ?? 1) * category.strength;
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

export function visibleConnections(
  list: ReadonlyArray<NavConnection>,
  isNodeVisible: (node: number) => boolean,
  isEdgeVisible: (edge: number) => boolean,
  filter: DirectionFilter,
): NavConnection[] {
  return list.filter(
    (connection) =>
      isNodeVisible(connection.other) &&
      isEdgeVisible(connection.edge) &&
      (filter === "all" || connection.direction === filter || connection.direction === "both"),
  );
}
