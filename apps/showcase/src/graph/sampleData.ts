import type { GraphEdge, GraphNode, LinkCategory, NodeCategory } from "@nexus-cyberdeck/graph";

/* ============================================================================
   Sample data for the Graph page — the ATLAS/TAG/UNRSLV/SOURCE/AGENT/NODE
   taxonomy and the random corpus generator used to live in the prototype
   itself (as `NODE_TYPES`/`LINK_TYPES`/`generateGraph`). Moved here because
   @nexus-cyberdeck/graph is domain-agnostic — this is one demo's sample
   data, same status as apps/showcase/src/data.ts and home-data.ts.
   ========================================================================== */

export const NODE_CATEGORIES: Record<string, NodeCategory> = {
  moc:      { label: "ATLAS",  code: "ATL", tier: 0, shape: 1, color: "#C6F135", size: 3.6, charge: 3.2, mass: 3.4 },
  note:     { label: "NODE",   code: "NDE", tier: 3, shape: 0, color: "#17E2E5", size: 1.7, charge: 1.0, mass: 1.0 },
  question: { label: "UNRSLV", code: "UNR", tier: 1, shape: 5, color: "#FF2E63", size: 2.1, charge: 1.3, mass: 0.7 },
  source:   { label: "SOURCE", code: "SRC", tier: 2, shape: 4, color: "#FF8A1E", size: 1.8, charge: 1.1, mass: 1.3 },
  person:   { label: "AGENT",  code: "AGT", tier: 2, shape: 3, color: "#9D7BFF", size: 2.2, charge: 1.5, mass: 1.5 },
  tag:      { label: "TAG",    code: "TAG", tier: 0, shape: 2, color: "#7CFF4F", size: 1.4, charge: 0.6, mass: 0.5 },
};
export const NODE_CATEGORY_IDS = Object.keys(NODE_CATEGORIES);

// Link colours are deliberately bright: the CRT composite removes ~45% of
// signal, so anything that starts dim disappears entirely on screen.
export const LINK_CATEGORIES: Record<string, LinkCategory> = {
  refs:        { label: "LINK",     color: "#3AC6D4", width: 1.15, dist: 1.00, strength: 0.55, dash: 0,   arrow: true,  flow: 1.0,  curve: 0.13, jit: 0 },
  cites:       { label: "CITE",     color: "#FF8A1E", width: 1.40, dist: 1.35, strength: 0.40, dash: 0,   arrow: true,  flow: 0.5,  curve: 0.20, jit: 0 },
  tagged:      { label: "TAGGED",   color: "#C6F135", width: 0.95, dist: 0.48, strength: 0.95, dash: 2.4, arrow: false, flow: 0,    curve: 0.05, jit: 0 },
  mentions:    { label: "MENTION",  color: "#A98BFF", width: 1.00, dist: 1.10, strength: 0.28, dash: 1.3, arrow: true,  flow: 0.3,  curve: 0.27, jit: 0 },
  contradicts: { label: "CONFLICT", color: "#FF2E63", width: 1.50, dist: 1.60, strength: 0.20, dash: 0,   arrow: false, flow: -1.0, curve: 0.36, jit: 1 },
};
export const LINK_CATEGORY_IDS = Object.keys(LINK_CATEGORIES);

const W_A = ["liminal", "recursive", "brittle", "molten", "adjacent", "hollow", "umbral", "narrow", "folded", "tidal", "opaque", "severed", "grafted", "latent", "static"];
const W_B = ["threshold", "protocol", "grammar", "residue", "aperture", "scaffold", "corpus", "vector", "margin", "ledger", "atlas", "relay", "basin", "index", "cache"];
const AGENTS = ["OKONKWO", "HALVORSEN", "RIVAS", "ALDOURI", "FENN", "KAUR", "MBEKI", "OSEI", "TERZIAN", "NOVAK", "BELLO", "ITO", "MARCHETTI", "ADEYEMI"];
const SRC = ["ARXIV", "DUMP", "INTERCEPT", "FIELDLOG", "TRANSCRIPT", "DATASET", "ARCHIVE", "LEAK"];
const pick = <T,>(a: readonly T[]): T => a[(Math.random() * a.length) | 0]!;

export interface SampleGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function generateSampleGraph(total: number): SampleGraph {
  const nodes: GraphNode[] = [];
  const add = (categoryId: string, label: string): number => {
    nodes.push({ id: nodes.length, categoryId, label, state: Math.random() < 0.12 ? 2 : Math.random() < 0.18 ? 0 : 1 });
    return nodes.length - 1;
  };
  const nMoc = Math.max(3, Math.round(total * 0.032));
  const nTag = Math.max(4, Math.round(total * 0.075));
  const nPerson = Math.max(3, Math.round(total * 0.06));
  const nSource = Math.max(4, Math.round(total * 0.115));
  const nQ = Math.max(2, Math.round(total * 0.05));
  const nNote = Math.max(10, total - nMoc - nTag - nPerson - nSource - nQ);

  const mocs: number[] = [], tags: number[] = [], people: number[] = [], sources: number[] = [], questions: number[] = [], notes: number[] = [];
  for (let i = 0; i < nMoc; i++) mocs.push(add("moc", pick(W_B).toUpperCase() + "//ATLAS"));
  for (let i = 0; i < nTag; i++) tags.push(add("tag", "#" + pick(W_A)));
  for (let i = 0; i < nPerson; i++) people.push(add("person", pick(AGENTS)));
  for (let i = 0; i < nSource; i++) sources.push(add("source", pick(SRC) + "-" + (100 + ((Math.random() * 899) | 0))));
  for (let i = 0; i < nQ; i++) questions.push(add("question", "?" + pick(W_A) + "_" + pick(W_B)));
  for (let i = 0; i < nNote; i++) notes.push(add("note", pick(W_A) + "_" + pick(W_B)));

  const seen = new Set<number>(), edges: GraphEdge[] = [];
  const link = (a: number, b: number, categoryId: string): boolean => {
    if (a === b) return false;
    const k = a < b ? a * 100000 + b : b * 100000 + a;
    if (seen.has(k)) return false;
    seen.add(k); edges.push({ a, b, categoryId }); return true;
  };
  const mocOf = new Map<number, number>();
  for (const id of notes) {
    const home = mocs[(Math.random() * mocs.length) | 0]!;
    mocOf.set(id, home); link(home, id, "refs");
    if (Math.random() < 0.10) link(mocs[(Math.random() * mocs.length) | 0]!, id, "refs");
  }
  for (const id of notes) {
    const sibs = notes.filter((o) => mocOf.get(o) === mocOf.get(id));
    const k = 1 + ((Math.random() * 2.4) | 0);
    for (let j = 0; j < k && sibs.length > 1; j++) link(id, sibs[(Math.random() * sibs.length) | 0]!, "refs");
  }
  for (const id of notes) {
    const k = Math.random() < 0.55 ? 1 : Math.random() < 0.8 ? 2 : 0;
    for (let j = 0; j < k; j++) link(id, tags[(Math.random() * tags.length) | 0]!, "tagged");
  }
  for (const q of questions) link(q, tags[(Math.random() * tags.length) | 0]!, "tagged");
  for (const s of sources) {
    const k = 1 + ((Math.random() * 3) | 0);
    for (let j = 0; j < k; j++) link(notes[(Math.random() * notes.length) | 0]!, s, "cites");
  }
  for (const p of people) {
    const k = 1 + ((Math.random() * 3.5) | 0);
    for (let j = 0; j < k; j++) link(notes[(Math.random() * notes.length) | 0]!, p, "mentions");
    if (Math.random() < 0.5) link(p, sources[(Math.random() * sources.length) | 0]!, "cites");
  }
  for (const q of questions) {
    const k = 1 + ((Math.random() * 2) | 0);
    for (let j = 0; j < k; j++) link(notes[(Math.random() * notes.length) | 0]!, q, "refs");
  }
  const nC = Math.max(2, Math.round(total * 0.022));
  for (let i = 0; i < nC; i++) {
    const a = notes[(Math.random() * notes.length) | 0]!, b = notes[(Math.random() * notes.length) | 0]!;
    if (mocOf.get(a) !== mocOf.get(b)) link(a, b, "contradicts");
  }
  return { nodes, edges };
}
