import type { LinkCategory, NodeCategory } from "@nexus-cyberdeck/graph";

export const NODE_CATEGORIES = {
  moc: {
    label: "ATLAS",
    code: "ATL",
    tier: 0,
    shape: 1,
    color: "#C6F135",
    size: 3.6,
    charge: 3.2,
    mass: 3.4,
  },
  note: {
    label: "NODE",
    code: "NDE",
    tier: 3,
    shape: 0,
    color: "#17E2E5",
    size: 1.7,
    charge: 1.0,
    mass: 1.0,
  },
  question: {
    label: "UNRSLV",
    code: "UNR",
    tier: 1,
    shape: 5,
    color: "#FF2E63",
    size: 2.1,
    charge: 1.3,
    mass: 0.7,
  },
  source: {
    label: "SOURCE",
    code: "SRC",
    tier: 2,
    shape: 4,
    color: "#FF8A1E",
    size: 1.8,
    charge: 1.1,
    mass: 1.3,
  },
  person: {
    label: "AGENT",
    code: "AGT",
    tier: 2,
    shape: 3,
    color: "#9D7BFF",
    size: 2.2,
    charge: 1.5,
    mass: 1.5,
  },
  tag: {
    label: "TAG",
    code: "TAG",
    tier: 0,
    shape: 2,
    color: "#7CFF4F",
    size: 1.4,
    charge: 0.6,
    mass: 0.5,
  },
} as const satisfies Record<string, NodeCategory>;
export type NodeCategoryId = keyof typeof NODE_CATEGORIES;
export const NODE_CATEGORY_IDS = Object.keys(NODE_CATEGORIES) as NodeCategoryId[];

// Bright on purpose: the CRT composite removes ~45% of the signal.
// Routing, dash and gain differ per kind so the legend survives greyscale and colour blindness.
export const LINK_CATEGORIES = {
  refs: {
    label: "LINK",
    color: "#3AC6D4",
    width: 1.0,
    dist: 1.0,
    strength: 0.55,
    routing: "etched",
    gain: 0.55,
    verb: "links to",
    inverseVerb: "linked from",
  },
  cites: {
    label: "CITE",
    color: "#FF8A1E",
    width: 1.1,
    dist: 1.35,
    strength: 0.4,
    routing: "arc",
    curve: 0.2,
    flow: 0.5,
    verb: "cites",
    inverseVerb: "cited by",
  },
  tagged: {
    label: "TAGGED",
    color: "#C6F135",
    width: 0.9,
    dist: 0.48,
    strength: 0.95,
    dash: 7,
    gain: 0.75,
    directed: false,
    verb: "tagged with",
  },
  mentions: {
    label: "MENTION",
    color: "#A98BFF",
    width: 0.95,
    dist: 1.1,
    strength: 0.28,
    routing: "arc",
    curve: 0.27,
    dash: 5,
    gain: 0.85,
    flow: 0.3,
    verb: "mentions",
    inverseVerb: "mentioned by",
  },
  contradicts: {
    label: "CONFLICT",
    color: "#FF2E63",
    width: 1.2,
    dist: 1.6,
    strength: 0.2,
    gain: 1.2,
    jit: 1,
    directed: false,
    verb: "conflicts with",
  },
} as const satisfies Record<string, LinkCategory>;
export type LinkCategoryId = keyof typeof LINK_CATEGORIES;
export const LINK_CATEGORY_IDS = Object.keys(LINK_CATEGORIES) as LinkCategoryId[];

/** Throws for an id this taxonomy lacks: the data and the taxonomy have drifted apart. */
export function nodeCategory(id: string): NodeCategory {
  const categories: Record<string, NodeCategory> = NODE_CATEGORIES;
  const category = categories[id];
  if (!category) throw new Error(`Unknown node category "${id}"`);
  return category;
}

export function linkCategory(id: string): LinkCategory {
  const categories: Record<string, LinkCategory> = LINK_CATEGORIES;
  const category = categories[id];
  if (!category) throw new Error(`Unknown link category "${id}"`);
  return category;
}
