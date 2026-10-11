import { Color } from "three";
import { DEFAULT_ARC_BOW, EDGE_ATTRS, encodeGain, encodeRouting } from "./shaders.js";
import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "./types.js";

/** Slots of an edge's `iP2` attribute (4 floats per edge). */
export const A_TIER = 0,
  A_HIDE = 1,
  A_JIT = 2,
  A_FRAY = 3;

/** Where edges stop short of a node's centre, in node radii; the same at both ends. */
export const EDGE_END_TRIM = 1.15;

export interface NodeBuffers {
  /** World units: the category's (or node's) size, grown by up to 2.4× with degree. */
  nodeRadii: Float32Array;
  nodeShapes: Float32Array;
  /** Linear RGB, 3 floats per node. */
  nodeColors: Float32Array;
  /** [0, 1) from the visual random stream. */
  nodeSeeds: Float32Array;
  /** Neighbourhood depth; -1 until a selection fills it. */
  nodeDepths: Float32Array;
  nodeMarks: Float32Array;
  nodeHidden: Float32Array;
  nodeTiers: Float32Array;
}

export interface EdgeBuffers {
  /** Live endpoint positions, 2 floats per edge; filled each frame. */
  edgeAPositions: Float32Array;
  edgeBPositions: Float32Array;
  /** Linear RGB, 3 floats per edge. */
  edgeColors: Float32Array;
  /** width, encoded routing and curve, dash, encoded gain and direction. */
  edgeParams0: Float32Array;
  /** flow, seed in [0, 1), trimmed radius at a, trimmed radius at b. */
  edgeParams1: Float32Array;
  /** tier, hide, jit, fray: see `A_TIER`…`A_FRAY`. */
  edgeParams2: Float32Array;
}

export type PackedBuffers = NodeBuffers & EdgeBuffers;

export interface PackNodesInput {
  nodes: readonly GraphNode[];
  nodeCategories: Readonly<Record<string, NodeCategory>>;
  nodeCategoryIds: readonly string[];
  degree: Uint16Array;
  /** Called once per node, in order. */
  visualRandom: () => number;
}

export interface PackEdgesInput {
  liveEdges: readonly GraphEdge[];
  linkCategories: Readonly<Record<string, LinkCategory>>;
  edgeCategoryIds: readonly string[];
  edgeEndA: Int32Array;
  edgeEndB: Int32Array;
  nodeRadii: Float32Array;
  /** Called once per edge, in order. */
  visualRandom: () => number;
}

export type PackBuffersInput = PackNodesInput & Omit<PackEdgesInput, "nodeRadii">;

/**
 * Packs the per-node and per-edge GPU attribute arrays. Draws every node seed
 * before any edge seed, so a graph's node seeds don't depend on its edges.
 */
export function packBuffers(input: PackBuffersInput): PackedBuffers {
  const nodeBuffers = packNodes(input);
  return { ...nodeBuffers, ...packEdges({ ...input, nodeRadii: nodeBuffers.nodeRadii }) };
}

/** Per-node attributes; draws one `visualRandom` value per node. */
export function packNodes(input: PackNodesInput): NodeBuffers {
  const { nodes, nodeCategories, nodeCategoryIds, degree, visualRandom } = input;
  const nodeCount = nodes.length;
  const nodeRadii = new Float32Array(nodeCount),
    nodeShapes = new Float32Array(nodeCount);
  const nodeColors = new Float32Array(nodeCount * 3),
    nodeSeeds = new Float32Array(nodeCount);
  const nodeDepths = new Float32Array(nodeCount).fill(-1);
  const nodeMarks = new Float32Array(nodeCount),
    nodeHidden = new Float32Array(nodeCount);
  const nodeTiers = new Float32Array(nodeCount);
  const scratchColor = new Color();
  for (let i = 0; i < nodeCount; i++) {
    const category = nodeCategories[nodeCategoryIds[i]!]!;
    nodeRadii[i] =
      (nodes[i]!.size ?? category.size) * (1 + Math.min(1.4, Math.log2(1 + degree[i]!) * 0.16));
    nodeShapes[i] = category.shape;
    scratchColor.set(category.color);
    nodeColors[i * 3] = scratchColor.r;
    nodeColors[i * 3 + 1] = scratchColor.g;
    nodeColors[i * 3 + 2] = scratchColor.b;
    nodeSeeds[i] = visualRandom();
    nodeTiers[i] = category.tier;
  }
  return {
    nodeRadii,
    nodeShapes,
    nodeColors,
    nodeSeeds,
    nodeDepths,
    nodeMarks,
    nodeHidden,
    nodeTiers,
  };
}

/** Per-edge attributes; draws one `visualRandom` value per edge. */
export function packEdges(input: PackEdgesInput): EdgeBuffers {
  const { liveEdges, linkCategories, edgeCategoryIds, edgeEndA, edgeEndB, nodeRadii } = input;
  const { visualRandom } = input;
  const edgeCount = liveEdges.length;
  const edgeAPositions = new Float32Array(edgeCount * 2),
    edgeBPositions = new Float32Array(edgeCount * 2);
  const edgeColors = new Float32Array(edgeCount * 3);
  const edgeParams0 = new Float32Array(edgeCount * EDGE_ATTRS.iP0);
  const edgeParams1 = new Float32Array(edgeCount * EDGE_ATTRS.iP1);
  const edgeParams2 = new Float32Array(edgeCount * EDGE_ATTRS.iP2);
  const scratchColor = new Color();
  for (let e = 0; e < edgeCount; e++) {
    const category = linkCategories[edgeCategoryIds[e]!]!;
    scratchColor.set(category.color);
    edgeColors[e * 3] = scratchColor.r;
    edgeColors[e * 3 + 1] = scratchColor.g;
    edgeColors[e * 3 + 2] = scratchColor.b;
    edgeParams0[e * 4] = category.width;
    // Alternating sign keeps adjacent arcs from overlapping.
    edgeParams0[e * 4 + 1] = encodeRouting(
      category.routing,
      (category.curve ?? DEFAULT_ARC_BOW) * (e % 2 === 0 ? 1 : -1),
    );
    edgeParams0[e * 4 + 2] = category.dash ?? 0;
    edgeParams0[e * 4 + 3] = encodeGain(category.gain ?? 1, category.directed ?? true);
    edgeParams1[e * 4] = category.flow ?? 0;
    edgeParams1[e * 4 + 1] = visualRandom();
    edgeParams1[e * 4 + 2] = nodeRadii[edgeEndA[e]!]! * EDGE_END_TRIM;
    edgeParams1[e * 4 + 3] = nodeRadii[edgeEndB[e]!]! * EDGE_END_TRIM;
    edgeParams2[e * 4 + A_JIT] = category.jit ?? 0;
    const absent = liveEdges[e]!.absentEnd;
    edgeParams2[e * 4 + A_FRAY] = absent === "b" ? 1 : absent === "a" ? 2 : 0;
  }
  return { edgeAPositions, edgeBPositions, edgeColors, edgeParams0, edgeParams1, edgeParams2 };
}
