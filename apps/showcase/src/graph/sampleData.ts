// The package's own generator, so "the same data on every load" uses the
// one implementation the layout seeds from: the screenshot baselines and a
// reader's sense of where things are both hold still.
import { mulberry32 } from "@nexus-cyberdeck/graph";
import type { GraphEdge, GraphNode } from "@nexus-cyberdeck/graph";

/* ============================================================================
   Sample data for the Graph page — the random corpus drawn over the taxonomy
   in taxonomy.ts. One demo's sample data, same status as
   apps/showcase/src/data.ts and home-data.ts; @nexus-cyberdeck/graph itself
   is domain-agnostic.
   ========================================================================== */

const W_A = [
  "liminal",
  "recursive",
  "brittle",
  "molten",
  "adjacent",
  "hollow",
  "umbral",
  "narrow",
  "folded",
  "tidal",
  "opaque",
  "severed",
  "grafted",
  "latent",
  "static",
];
const W_B = [
  "threshold",
  "protocol",
  "grammar",
  "residue",
  "aperture",
  "scaffold",
  "corpus",
  "vector",
  "margin",
  "ledger",
  "atlas",
  "relay",
  "basin",
  "index",
  "cache",
];
const AGENTS = [
  "OKONKWO",
  "HALVORSEN",
  "RIVAS",
  "ALDOURI",
  "FENN",
  "KAUR",
  "MBEKI",
  "OSEI",
  "TERZIAN",
  "NOVAK",
  "BELLO",
  "ITO",
  "MARCHETTI",
  "ADEYEMI",
];
const SRC = ["ARXIV", "DUMP", "INTERCEPT", "FIELDLOG", "TRANSCRIPT", "DATASET", "ARCHIVE", "LEAK"];
/** The seed the showcase's sample graph is generated from. */
export const SAMPLE_SEED = 0x6e657875; // "nexu"

export interface SampleGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

type Random = () => number;
type Link = (a: number, b: number, categoryId: string, absentEnd?: "a" | "b") => void;

/** The generated node ids, by category. */
interface Corpus {
  nodes: GraphNode[];
  mocs: number[];
  tags: number[];
  people: number[];
  sources: number[];
  questions: number[];
  notes: number[];
}

/** A corpus being linked: its nodes, the shared draw and the edge sink. */
interface Build extends Corpus {
  /** The size asked for; `nodes` can run over it for a very small corpus. */
  total: number;
  random: Random;
  link: Link;
}

// Every step below draws from one `random` in a fixed order, so reordering a
// draw reshuffles the whole graph and moves every screenshot baseline.

function pickFrom<T>(random: Random, list: readonly T[]): T {
  const item = list[(random() * list.length) | 0];
  if (item === undefined) throw new Error("pickFrom needs a non-empty list");
  return item;
}

function repeat(times: number, step: () => void): void {
  for (let i = 0; i < times; i++) step();
}

function createNodes(total: number, random: Random): Corpus {
  const pick = <T>(list: readonly T[]) => pickFrom(random, list);
  const nodes: GraphNode[] = [];
  const addAll = (count: number, categoryId: string, makeLabel: () => string): number[] =>
    Array.from({ length: count }, () => {
      const label = makeLabel();
      nodes.push({
        id: nodes.length,
        categoryId,
        label,
        state: random() < 0.12 ? 2 : random() < 0.18 ? 0 : 1,
      });
      return nodes.length - 1;
    });
  const nMoc = Math.max(3, Math.round(total * 0.032));
  const nTag = Math.max(4, Math.round(total * 0.075));
  const nPerson = Math.max(3, Math.round(total * 0.06));
  const nSource = Math.max(4, Math.round(total * 0.115));
  const nQ = Math.max(2, Math.round(total * 0.05));
  const nNote = Math.max(10, total - nMoc - nTag - nPerson - nSource - nQ);
  return {
    nodes,
    mocs: addAll(nMoc, "moc", () => pick(W_B).toUpperCase() + "//ATLAS"),
    tags: addAll(nTag, "tag", () => "#" + pick(W_A)),
    people: addAll(nPerson, "person", () => pick(AGENTS)),
    sources: addAll(nSource, "source", () => pick(SRC) + "-" + (100 + ((random() * 899) | 0))),
    questions: addAll(nQ, "question", () => "?" + pick(W_A) + "_" + pick(W_B)),
    notes: addAll(nNote, "note", () => pick(W_A) + "_" + pick(W_B)),
  };
}

/** Hangs each note off an atlas, and some off a second. Returns each note's home. */
function linkAtlases({ mocs, notes, random, link }: Build): Map<number, number> {
  const mocOf = new Map<number, number>();
  for (const id of notes) {
    const home = pickFrom(random, mocs);
    mocOf.set(id, home);
    link(home, id, "refs");
    if (random() < 0.1) link(pickFrom(random, mocs), id, "refs");
  }
  return mocOf;
}

function linkSiblings({ notes, random, link }: Build, mocOf: Map<number, number>): void {
  for (const id of notes) {
    const siblings = notes.filter((o) => mocOf.get(o) === mocOf.get(id));
    const times = 1 + ((random() * 2.4) | 0);
    if (siblings.length > 1) repeat(times, () => link(id, pickFrom(random, siblings), "refs"));
  }
}

function linkClaims({ tags, people, sources, questions, notes, random, link }: Build): void {
  for (const id of notes) {
    const times = random() < 0.55 ? 1 : random() < 0.8 ? 2 : 0;
    repeat(times, () => link(id, pickFrom(random, tags), "tagged"));
  }
  for (const q of questions) link(q, pickFrom(random, tags), "tagged");
  for (const s of sources) {
    repeat(1 + ((random() * 3) | 0), () => link(pickFrom(random, notes), s, "cites"));
  }
  for (const p of people) {
    repeat(1 + ((random() * 3.5) | 0), () => link(pickFrom(random, notes), p, "mentions"));
    if (random() < 0.5) link(p, pickFrom(random, sources), "cites");
  }
  // A note pointing at an unresolved question points at something with
  // nothing behind it yet: the trace frays out toward the question and lands
  // on no pad (GraphEdge.absentEnd).
  for (const q of questions) {
    repeat(1 + ((random() * 2) | 0), () => link(pickFrom(random, notes), q, "refs", "b"));
  }
}

function linkConflicts({ total, notes, random, link }: Build, mocOf: Map<number, number>): void {
  repeat(Math.max(2, Math.round(total * 0.022)), () => {
    const a = pickFrom(random, notes);
    const b = pickFrom(random, notes);
    if (mocOf.get(a) !== mocOf.get(b)) link(a, b, "contradicts");
  });
}

export function generateSampleGraph(total: number, seed: number = SAMPLE_SEED): SampleGraph {
  const random = mulberry32(seed);
  const seen = new Set<number>();
  const edges: GraphEdge[] = [];
  const link: Link = (a, b, categoryId, absentEnd) => {
    if (a === b) return;
    const key = a < b ? a * 100000 + b : b * 100000 + a;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(absentEnd ? { a, b, categoryId, absentEnd } : { a, b, categoryId });
  };
  const build: Build = { ...createNodes(total, random), total, random, link };
  const mocOf = linkAtlases(build);
  linkSiblings(build, mocOf);
  linkClaims(build);
  linkConflicts(build, mocOf);
  return { nodes: build.nodes, edges };
}
