import { computeDegree } from "./physics.js";
import type { PhysicsGraph } from "./physics.js";
import { seedFromIds } from "./random.js";
import { ORPHAN_STATE } from "./types.js";
import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";
import { validateGraph } from "./validate.js";
import type { DroppedEdge, InvalidEdgePolicy } from "./validate.js";

export interface PrepareGraphInput {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  nodeCategories: Readonly<Record<string, NodeCategory>>;
  linkCategories: Readonly<Record<string, LinkCategory>>;
  invalidEdges?: InvalidEdgePolicy | undefined;
  /** `null` opts out of seeding; `undefined` derives a seed from the node ids. */
  seed?: number | null | undefined;
}

export interface PreparedGraph {
  idToIndex: Map<unknown, number>;
  /** Dense node index of each live edge's `a`; `edgeEndB` likewise for `b`. */
  edgeEndA: Int32Array;
  edgeEndB: Int32Array;
  /** Edges that survived validation; every per-edge array is parallel to this. */
  liveEdges: readonly GraphEdge[];
  dropped: readonly DroppedEdge[];
  nodeCount: number;
  edgeCount: number;
  nodeCategoryIds: string[];
  denseIds: GraphNode["id"][];
  edgeCategoryIds: string[];
  linkCategoryIds: string[];
  /** Live-edge count touching each node. */
  degree: Uint16Array;
  /** Displayed state per node: `ORPHAN_STATE` for a node with no live edge, else its own (default 1). */
  nodeStates: Uint8Array;
  /** `undefined` means unseeded: the solver and the visual stream use `Math.random`. */
  layoutSeed: number | undefined;
  physicsGraph: PhysicsGraph;
}

/**
 * Validates the graph and derives everything boot needs before it touches the GPU.
 * Draws no random numbers. Throws on invalid input, naming the first bad entry.
 */
export function prepareGraph(input: PrepareGraphInput): PreparedGraph {
  const { nodes, edges, nodeCategories, linkCategories, invalidEdges, seed } = input;
  const {
    idToIndex,
    eA: edgeEndA,
    eB: edgeEndB,
    edges: liveEdges,
    dropped,
  } = validateGraph(nodes, edges, nodeCategories, linkCategories, invalidEdges);
  const nodeCount = nodes.length,
    edgeCount = liveEdges.length;

  const nodeCategoryIds = nodes.map((node) => node.categoryId);
  const denseIds = nodes.map((node) => node.id);
  const edgeCategoryIds = liveEdges.map((edge) => edge.categoryId);
  const linkCategoryIds = Object.keys(linkCategories);
  const degree = computeDegree(
    Array.from({ length: edgeCount }, (_, e) => ({ a: edgeEndA[e]!, b: edgeEndB[e]! })),
    nodeCount,
  );
  const nodeStates = new Uint8Array(nodeCount);
  for (let i = 0; i < nodeCount; i++)
    nodeStates[i] = degree[i] === 0 ? ORPHAN_STATE : (nodes[i]!.state ?? 1);

  const layoutSeed =
    seed === null ? undefined : (seed ?? seedFromIds(nodes.map((node) => node.id)));

  return {
    idToIndex,
    edgeEndA,
    edgeEndB,
    liveEdges,
    dropped,
    nodeCount,
    edgeCount,
    nodeCategoryIds,
    denseIds,
    edgeCategoryIds,
    linkCategoryIds,
    degree,
    nodeStates,
    layoutSeed,
    physicsGraph: buildPhysicsGraph({
      nodes,
      nodeCategories,
      linkCategories,
      edgeCategoryIds,
      edgeEndA,
      edgeEndB,
    }),
  };
}

export interface PhysicsGraphInput {
  nodes: readonly GraphNode[];
  nodeCategories: Readonly<Record<string, NodeCategory>>;
  linkCategories: Readonly<Record<string, LinkCategory>>;
  /** Category of each live edge, parallel to `edgeEndA`/`edgeEndB`. */
  edgeCategoryIds: readonly string[];
  edgeEndA: Int32Array;
  edgeEndB: Int32Array;
}

/** The solver's view of the graph: a node's own `sectorAngle`/`radiusTarget` override its category's. */
export function buildPhysicsGraph(input: PhysicsGraphInput): PhysicsGraph {
  const { nodes, nodeCategories, linkCategories, edgeCategoryIds, edgeEndA, edgeEndB } = input;
  return {
    nodes: nodes.map((node) => {
      const category = nodeCategories[node.categoryId]!;
      // Spread only when defined: under exactOptionalPropertyTypes `undefined` isn't absent.
      const sectorAngle = node.sectorAngle ?? category.sectorAngle;
      const radiusTarget = node.radiusTarget ?? category.radiusTarget;
      return {
        charge: category.charge,
        mass: category.mass,
        ...(sectorAngle === undefined ? {} : { sectorAngle }),
        ...(radiusTarget === undefined ? {} : { radiusTarget }),
      };
    }),
    edges: Array.from({ length: edgeCategoryIds.length }, (_, e) => {
      const category = linkCategories[edgeCategoryIds[e]!]!;
      return {
        a: edgeEndA[e]!,
        b: edgeEndB[e]!,
        dist: category.dist,
        strength: category.strength,
      };
    }),
  };
}
