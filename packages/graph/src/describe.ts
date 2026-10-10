import { buildConnections, defaultRank, visibleConnections } from "./a11y/adjacency.js";
import type { DirectionFilter, NavConnection } from "./a11y/adjacency.js";
import { validateGraph } from "./validate.js";
import { isolationSet } from "./neighbourhood.js";
import type { Connection, GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

export interface DescribeContext {
  categoryLabel: string;
  /** Reachable connections only: hidden categories and isolation are left out. */
  connections: number;
  selected: boolean;
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export function summaryText(nodes: number, connections: number, kinds: number): string {
  return `Graph, ${plural(nodes, "node")}, ${plural(connections, "connection")} in ${plural(kinds, "kind")}.`;
}

export function defaultNodeText(label: string, ctx: DescribeContext): string {
  return `${label}, ${ctx.categoryLabel.toLowerCase()}, ${plural(ctx.connections, "connection")}`;
}

export function relationText(
  category: LinkCategory,
  direction: NavConnection["direction"],
): string {
  const label = category.label.toLowerCase();
  if (direction === "out") return category.verb ?? `${label} to`;
  if (direction === "in") return category.inverseVerb ?? `${label} from`;
  return category.verb ?? `${label} with`;
}

/** `position` is 1-based. */
export function connectionText(
  category: LinkCategory,
  connection: NavConnection,
  otherLabel: string,
  otherCategoryLabel: string,
  position: number,
  of: number,
): string {
  const rank = position === 1 && of > 1 ? ", strongest" : "";
  return `${relationText(category, connection.direction)} ${otherLabel}, ${otherCategoryLabel.toLowerCase()}. ${position} of ${of}${rank}`;
}

const FILTER_TEXT = {
  all: "All connections",
  out: "Outgoing",
  in: "Incoming",
} as const satisfies Record<DirectionFilter, string>;

export function filterText(filter: DirectionFilter, count: number): string {
  return `${FILTER_TEXT[filter]}, ${plural(count, "connection")}`;
}

export function detailText(
  label: string,
  ctx: DescribeContext,
  byRelation: ReadonlyArray<readonly [relation: string, count: number]>,
): string {
  const parts = byRelation.map(([relation, count]) => `${count} ${relation}`).join(", ");
  const counts = ctx.connections > 0 ? `: ${parts}` : "";
  return `${label}. Kind: ${ctx.categoryLabel.toLowerCase()}. ${plural(ctx.connections, "connection")}${counts}. ${ctx.selected ? "Selected" : "Not selected"}.`;
}

export const HELP_TEXT =
  "Left and right arrows: browse connections. Up and down: change direction. " +
  "Enter: follow. Backspace: back. Space: select. Home: start. D: describe. Escape: step out.";

export interface OutlineConnection {
  /** As read from this node, e.g. "cites" or "cited by". */
  relation: string;
  id: GraphNode["id"];
  label: string;
  /** The other node's category label. */
  kind: string;
}

export interface OutlineNode {
  id: GraphNode["id"];
  label: string;
  description: string;
  connections: OutlineConnection[];
}

export interface OutlineGroup {
  categoryId: string;
  label: string;
  nodes: OutlineNode[];
}

export interface GraphOutlineData {
  summary: string;
  groups: OutlineGroup[];
}

export interface DescribeGraphInput<T = unknown> {
  nodes: readonly GraphNode<T>[];
  edges: readonly GraphEdge[];
  nodeCategories: Readonly<Record<string, NodeCategory>>;
  linkCategories: Readonly<Record<string, LinkCategory>>;
  hiddenNodeCategories?: readonly string[];
  hiddenLinkCategories?: readonly string[];
  isolateId?: GraphNode["id"] | null;
  /** Default "error". */
  invalidEdges?: "error" | "drop";
  rankConnections?: (a: Connection<T>, b: Connection<T>) => number;
  describeNode?: (node: GraphNode<T>, ctx: DescribeContext) => string;
}

/** Categories in declaration order, nodes by label, connections ranked as the navigator ranks them; hidden and isolated-out nodes are omitted. */
export function describeGraph<T = unknown>(input: DescribeGraphInput<T>): GraphOutlineData {
  const { nodes, nodeCategories, linkCategories } = input;
  const { edges, eA, eB, idToIndex } = validateGraph(
    nodes,
    input.edges,
    nodeCategories,
    linkCategories,
    input.invalidEdges ?? "error",
  );
  const hiddenNode = new Set(input.hiddenNodeCategories ?? []);
  const hiddenLink = new Set(input.hiddenLinkCategories ?? []);
  const labels = nodes.map((node) => node.label);
  const edgeCategoryIds = edges.map((edge) => edge.categoryId);
  const userRank = input.rankConnections;
  const rank = userRank
    ? (a: NavConnection, b: NavConnection) =>
        userRank(
          {
            other: nodes[a.other]!,
            edge: edges[a.edge]!,
            categoryId: a.categoryId,
            direction: a.direction,
            strength: a.strength,
          },
          {
            other: nodes[b.other]!,
            edge: edges[b.edge]!,
            categoryId: b.categoryId,
            direction: b.direction,
            strength: b.strength,
          },
        )
    : defaultRank(labels, Object.keys(linkCategories));
  const lists = buildConnections(nodes.length, eA, eB, edgeCategoryIds, linkCategories, rank);

  const isolatedIndex = input.isolateId == null ? -1 : (idToIndex.get(input.isolateId) ?? -1);
  const allow = isolationSet(isolatedIndex, eA, eB);
  const isVisible = (index: number) =>
    !hiddenNode.has(nodes[index]!.categoryId) && (allow === null || allow.has(index));
  const isEdgeVisible = (edge: number) => !hiddenLink.has(edgeCategoryIds[edge]!);
  const kindOf = (index: number) => nodeCategories[nodes[index]!.categoryId]!.label.toLowerCase();

  let shownNodes = 0,
    shownEdges = 0;
  const kinds = new Set<string>();
  for (let e = 0; e < edges.length; e++) {
    if (isEdgeVisible(e) && isVisible(eA[e]!) && isVisible(eB[e]!)) {
      shownEdges++;
      kinds.add(edgeCategoryIds[e]!);
    }
  }

  const byCategory = new Map<string, OutlineNode[]>();
  for (let i = 0; i < nodes.length; i++) {
    if (!isVisible(i)) continue;
    shownNodes++;
    const node = nodes[i]!;
    const connections = visibleConnections(lists[i]!, isVisible, isEdgeVisible, "all");
    const ctx: DescribeContext = {
      categoryLabel: nodeCategories[node.categoryId]!.label,
      connections: connections.length,
      selected: false,
    };
    const entry: OutlineNode = {
      id: node.id,
      label: node.label,
      description: input.describeNode
        ? input.describeNode(node, ctx)
        : defaultNodeText(node.label, ctx),
      connections: connections.map((connection) => ({
        relation: relationText(linkCategories[connection.categoryId]!, connection.direction),
        id: nodes[connection.other]!.id,
        label: labels[connection.other]!,
        kind: kindOf(connection.other),
      })),
    };
    const list = byCategory.get(node.categoryId) ?? [];
    list.push(entry);
    byCategory.set(node.categoryId, list);
  }

  const groups: OutlineGroup[] = [];
  for (const [categoryId, category] of Object.entries(nodeCategories)) {
    const list = byCategory.get(categoryId);
    if (!list) continue;
    list.sort((a, b) => a.label.localeCompare(b.label));
    groups.push({ categoryId, label: category.label, nodes: list });
  }
  return { summary: summaryText(shownNodes, shownEdges, kinds.size), groups };
}
