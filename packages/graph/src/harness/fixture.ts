import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "../types.js";

const NODE_COUNT = 10;
const EDGE_COUNT = 12;

/** Small enough to read in a recording, with every node and edge kind the canvas draws differently. */
export const nodeCategories = {
  hub: {
    label: "HUB",
    shape: 0,
    color: "#9EFF3D",
    code: "HUB",
    size: 9,
    charge: 1,
    mass: 1,
    tier: 0,
  },
  leaf: {
    label: "LEAF",
    shape: 1,
    color: "#17E2E5",
    code: "LF",
    size: 6,
    charge: 1,
    mass: 1,
    tier: 1,
  },
} as const satisfies Record<string, NodeCategory>;

export const linkCategories = {
  refs: {
    label: "REFS",
    color: "#17E2E5",
    width: 1,
    dist: 1,
    strength: 0.5,
    verb: "refers to",
    inverseVerb: "referred to by",
  },
  owns: {
    label: "OWNS",
    color: "#FF3DA5",
    width: 1,
    dist: 1,
    strength: 0.5,
    directed: true,
    verb: "owns",
    inverseVerb: "owned by",
  },
} as const satisfies Record<string, LinkCategory>;

export const nodes: GraphNode[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
  id: `n${i}`,
  categoryId: i % 3 === 0 ? "hub" : "leaf",
  label: `Node ${i}`,
}));

export const edges: GraphEdge[] = Array.from({ length: EDGE_COUNT }, (_, i) => ({
  a: `n${i % NODE_COUNT}`,
  b: `n${(i * 3 + 1) % NODE_COUNT}`,
  categoryId: i % 2 === 0 ? "owns" : "refs",
}));

export const ariaLabel = "Harness graph";

/**
 * The data paths the default fixture leaves alone: an orphan (drawn as
 * ORPHAN_STATE whatever it declares), a declared `state`, per-node `size`,
 * `sectorAngle` and `radiusTarget`, a link category that sets every optional
 * field, an edge with an absent end, and one edge `invalidEdges: "drop"` drops.
 */
export const variant = {
  linkCategories: {
    ...linkCategories,
    signal: {
      label: "SIGNAL",
      color: "#FFB000",
      width: 1.6,
      dist: 1.2,
      strength: 0.4,
      curve: 0.3,
      dash: 0.5,
      gain: 1.6,
      flow: 0.8,
      jit: 0.4,
      routing: "arc",
      directed: false,
    },
  } satisfies Record<string, LinkCategory>,
  nodes: [
    { id: "hub", categoryId: "hub", label: "Hub", state: 2, size: 12 },
    { id: "east", categoryId: "leaf", label: "East", sectorAngle: 0, radiusTarget: 80 },
    { id: "west", categoryId: "leaf", label: "West", state: 0, sectorAngle: 3.14159 },
    { id: "lone", categoryId: "leaf", label: "Lone", state: 2 },
  ] satisfies GraphNode[],
  edges: [
    { a: "hub", b: "east", categoryId: "signal" },
    { a: "hub", b: "west", categoryId: "owns", absentEnd: "b" },
    { a: "east", b: "west", categoryId: "refs" },
    { a: "hub", b: "nowhere", categoryId: "signal" },
  ] satisfies GraphEdge[],
  invalidEdges: "drop",
  seed: 42,
} as const;
