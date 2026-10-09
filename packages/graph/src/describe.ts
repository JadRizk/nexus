/* ============================================================================
   DESCRIBE — every sentence the graph speaks

   Pure strings for screen-reader announcements (and, later, the text outline).
   Kept in one place so the wording is consistent and testable, and so a
   consumer's own phrasing (`describeNode`, `verb`/`inverseVerb`) slots in at
   exactly the points it should.

   The wording follows QUARTZ (ASSETS '26): "X connected to Y" was not enough
   for blind readers, who needed the relation's type, its direction and its
   weight. So a connection is read as its verb, then the far node, then where
   it sits in the ranked list ("uses motion-tokens, token set. 2 of 6").
   Arrows are spoken as words; the glyphs are only for the visual key hints.
   ========================================================================== */

import { buildConnections, defaultRank, visibleConnections } from "./a11y/adjacency.js";
import type { DirectionFilter, NavConnection } from "./a11y/adjacency.js";
import { validateGraph } from "./validate.js";
import type { Connection, GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

/** What `describeNode` is given beyond the node itself. */
export interface DescribeContext {
  /** The node's category label, e.g. "skill". */
  categoryLabel: string;
  /** Number of connections the node has, counting hidden ones. */
  connections: number;
  selected: boolean;
}

const plural = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** "Graph, 120 nodes, 340 connections in 4 kinds." */
export function summaryText(nodes: number, connections: number, kinds: number): string {
  return `Graph, ${plural(nodes, "node")}, ${plural(connections, "connection")} in ${plural(kinds, "kind")}.`;
}

/** The default node description: "animate, skill, 6 connections". */
export function defaultNodeText(label: string, ctx: DescribeContext): string {
  return `${label}, ${ctx.categoryLabel.toLowerCase()}, ${plural(ctx.connections, "connection")}`;
}

/**
 * How a connection's relation reads from the node you're on.
 *
 * - Outgoing: the category's `verb` ("uses"), else "<label> to".
 * - Incoming: `inverseVerb` ("used by"), else "<label> from".
 * - Undirected: `verb`, else "<label> with".
 */
export function relationText(cat: LinkCategory, direction: NavConnection["direction"]): string {
  const label = cat.label.toLowerCase();
  if (direction === "out") return cat.verb ?? `${label} to`;
  if (direction === "in") return cat.inverseVerb ?? `${label} from`;
  return cat.verb ?? `${label} with`;
}

/** "uses motion-tokens, token set. 2 of 6, strongest". */
export function connectionText(
  cat: LinkCategory,
  conn: NavConnection,
  otherLabel: string,
  otherCategoryLabel: string,
  position: number,
  of: number,
): string {
  const rank = position === 1 && of > 1 ? ", strongest" : "";
  return `${relationText(cat, conn.direction)} ${otherLabel}, ${otherCategoryLabel.toLowerCase()}. ${position} of ${of}${rank}`;
}

const FILTER_TEXT: Record<DirectionFilter, string> = {
  all: "All connections",
  out: "Outgoing",
  in: "Incoming",
};

/** "Outgoing, 4 connections". */
export function filterText(filter: DirectionFilter, count: number): string {
  return `${FILTER_TEXT[filter]}, ${plural(count, "connection")}`;
}

/** "animate. Kind: skill. 6 connections: 4 uses, 2 documented by. Selected." */
export function detailText(
  label: string,
  ctx: DescribeContext,
  byRelation: ReadonlyArray<readonly [relation: string, count: number]>,
): string {
  const parts = byRelation.map(([rel, k]) => `${k} ${rel}`).join(", ");
  const counts = ctx.connections > 0 ? `: ${parts}` : "";
  return `${label}. Kind: ${ctx.categoryLabel.toLowerCase()}. ${plural(ctx.connections, "connection")}${counts}. ${ctx.selected ? "Selected" : "Not selected"}.`;
}

export const HELP_TEXT =
  "Left and right arrows: browse connections. Up and down: change direction. " +
  "Enter: follow. Backspace: back. Space: select. Home: start. D: describe. Escape: step out.";

/* ============================================================================
   OUTLINE — the whole graph as a structured list

   The text alternative (research R8, spec D10): every node, grouped by
   category, each with its connections read the same way the keyboard
   navigator reads them. For skimming, for a reader who'd rather not travel
   the canvas, and for tasks node-link diagrams are weakest at, like finding
   what two nodes have in common. `<GraphOutline>` in @nexus-cyberdeck/react
   renders it; nothing here touches the DOM.
   ========================================================================== */

export interface OutlineConnection {
  /** The relation as read from this node, e.g. "cites" or "cited by". */
  relation: string;
  /** The node at the other end. */
  id: GraphNode["id"];
  label: string;
  /** The other node's category label. */
  kind: string;
}

export interface OutlineNode {
  id: GraphNode["id"];
  label: string;
  /** The same sentence a screen reader hears on landing on the node. */
  description: string;
  connections: OutlineConnection[];
}

export interface OutlineGroup {
  categoryId: string;
  label: string;
  nodes: OutlineNode[];
}

export interface GraphOutlineData {
  /** "Graph, 120 nodes, 340 connections in 4 kinds." */
  summary: string;
  groups: OutlineGroup[];
}

export interface DescribeGraphInput {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  nodeCategories: Readonly<Record<string, NodeCategory>>;
  linkCategories: Readonly<Record<string, LinkCategory>>;
  /** Left out of the outline, as they are hidden on the canvas. */
  hiddenNodeCategories?: readonly string[];
  hiddenLinkCategories?: readonly string[];
  /** As on GraphCanvas. Default "error". */
  invalidEdges?: "error" | "drop";
  /** As on GraphCanvas, so the outline lists connections in the same order the keyboard reads them. */
  rankConnections?: (a: Connection, b: Connection) => number;
  /** As on GraphCanvas. */
  describeNode?: (node: GraphNode, ctx: DescribeContext) => string;
}

/**
 * The graph as an outline: categories in declaration order, nodes by label
 * within each, and each node's connections ranked as the keyboard navigator
 * ranks them. Hidden categories are left out, and so are connections to them.
 */
export function describeGraph(input: DescribeGraphInput): GraphOutlineData {
  const { nodes, nodeCategories, linkCategories } = input;
  const { edges, eA, eB } = validateGraph(
    nodes,
    input.edges,
    nodeCategories,
    linkCategories,
    input.invalidEdges ?? "error",
  );
  const hiddenNode = new Set(input.hiddenNodeCategories ?? []);
  const hiddenLink = new Set(input.hiddenLinkCategories ?? []);
  const labels = nodes.map((n) => n.label);
  const eCategoryId = edges.map((e) => e.categoryId);
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
  const lists = buildConnections(nodes.length, eA, eB, eCategoryId, linkCategories, rank);

  const isVisible = (i: number) => !hiddenNode.has(nodes[i]!.categoryId);
  const isEdgeVisible = (e: number) => !hiddenLink.has(eCategoryId[e]!);
  const kindOf = (i: number) => nodeCategories[nodes[i]!.categoryId]!.label.toLowerCase();

  let shownNodes = 0,
    shownEdges = 0;
  const kinds = new Set<string>();
  for (let e = 0; e < edges.length; e++) {
    if (isEdgeVisible(e) && isVisible(eA[e]!) && isVisible(eB[e]!)) {
      shownEdges++;
      kinds.add(eCategoryId[e]!);
    }
  }

  const byCategory = new Map<string, OutlineNode[]>();
  for (let i = 0; i < nodes.length; i++) {
    if (!isVisible(i)) continue;
    shownNodes++;
    const node = nodes[i]!;
    const conns = visibleConnections(lists[i]!, isVisible, isEdgeVisible, "all");
    const ctx: DescribeContext = {
      categoryLabel: nodeCategories[node.categoryId]!.label,
      connections: lists[i]!.length,
      selected: false,
    };
    const entry: OutlineNode = {
      id: node.id,
      label: node.label,
      description: input.describeNode
        ? input.describeNode(node, ctx)
        : defaultNodeText(node.label, ctx),
      connections: conns.map((c) => ({
        relation: relationText(linkCategories[c.categoryId]!, c.direction),
        id: nodes[c.other]!.id,
        label: labels[c.other]!,
        kind: kindOf(c.other),
      })),
    };
    const list = byCategory.get(node.categoryId) ?? [];
    list.push(entry);
    byCategory.set(node.categoryId, list);
  }

  const groups: OutlineGroup[] = [];
  for (const [categoryId, cat] of Object.entries(nodeCategories)) {
    const list = byCategory.get(categoryId);
    if (!list) continue;
    list.sort((a, b) => a.label.localeCompare(b.label));
    groups.push({ categoryId, label: cat.label, nodes: list });
  }
  return { summary: summaryText(shownNodes, shownEdges, kinds.size), groups };
}
