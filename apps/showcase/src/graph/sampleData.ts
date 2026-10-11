import { mulberry32 } from "@nexus-cyberdeck/graph";
import type { GraphEdge, GraphNode } from "@nexus-cyberdeck/graph";

const ADJECTIVES = [
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
const NOUNS = [
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
const SOURCES = [
  "ARXIV",
  "DUMP",
  "INTERCEPT",
  "FIELDLOG",
  "TRANSCRIPT",
  "DATASET",
  "ARCHIVE",
  "LEAK",
];
export const SAMPLE_SEED = 0x6e657875; // "nexu"

export interface SampleGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

type Random = () => number;
type Link = (a: number, b: number, categoryId: string, absentEnd?: "a" | "b") => void;

interface Corpus {
  nodes: GraphNode[];
  mocs: number[];
  tags: number[];
  people: number[];
  sources: number[];
  questions: number[];
  notes: number[];
}

interface Build extends Corpus {
  /** The size asked for; `nodes` can exceed it for a very small corpus. */
  total: number;
  random: Random;
  link: Link;
}

// One `random`, drawn in a fixed order: reordering a draw moves every screenshot baseline.

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
  const mocCount = Math.max(3, Math.round(total * 0.032));
  const tagCount = Math.max(4, Math.round(total * 0.075));
  const personCount = Math.max(3, Math.round(total * 0.06));
  const sourceCount = Math.max(4, Math.round(total * 0.115));
  const questionCount = Math.max(2, Math.round(total * 0.05));
  const noteCount = Math.max(
    10,
    total - mocCount - tagCount - personCount - sourceCount - questionCount,
  );
  return {
    nodes,
    mocs: addAll(mocCount, "moc", () => pick(NOUNS).toUpperCase() + "//ATLAS"),
    tags: addAll(tagCount, "tag", () => "#" + pick(ADJECTIVES)),
    people: addAll(personCount, "person", () => pick(AGENTS)),
    sources: addAll(
      sourceCount,
      "source",
      () => pick(SOURCES) + "-" + (100 + ((random() * 899) | 0)),
    ),
    questions: addAll(questionCount, "question", () => "?" + pick(ADJECTIVES) + "_" + pick(NOUNS)),
    notes: addAll(noteCount, "note", () => pick(ADJECTIVES) + "_" + pick(NOUNS)),
  };
}

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
    const siblings = notes.filter((other) => mocOf.get(other) === mocOf.get(id));
    const times = 1 + ((random() * 2.4) | 0);
    if (siblings.length > 1) repeat(times, () => link(id, pickFrom(random, siblings), "refs"));
  }
}

function linkClaims({ tags, people, sources, questions, notes, random, link }: Build): void {
  for (const id of notes) {
    const times = random() < 0.55 ? 1 : random() < 0.8 ? 2 : 0;
    repeat(times, () => link(id, pickFrom(random, tags), "tagged"));
  }
  for (const question of questions) link(question, pickFrom(random, tags), "tagged");
  for (const source of sources) {
    repeat(1 + ((random() * 3) | 0), () => link(pickFrom(random, notes), source, "cites"));
  }
  for (const person of people) {
    repeat(1 + ((random() * 3.5) | 0), () => link(pickFrom(random, notes), person, "mentions"));
    if (random() < 0.5) link(person, pickFrom(random, sources), "cites");
  }
  // An unresolved question has nothing behind it yet, so its end is absent.
  for (const question of questions) {
    repeat(1 + ((random() * 2) | 0), () => link(pickFrom(random, notes), question, "refs", "b"));
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
