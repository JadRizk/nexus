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
