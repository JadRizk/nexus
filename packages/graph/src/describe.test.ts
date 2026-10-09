import { describe, expect, it } from "vitest";
import {
  connectionText,
  defaultNodeText,
  describeGraph,
  detailText,
  filterText,
  relationText,
  summaryText,
} from "./describe.js";
import type { GraphNode, LinkCategory } from "./types.js";

const cat = (over: Partial<LinkCategory> = {}): LinkCategory => ({
  label: "Cites",
  color: "#fff",
  width: 1,
  dist: 1,
  strength: 1,
  ...over,
});

describe("summaryText", () => {
  it("counts nodes, connections and kinds, singular and plural", () => {
    expect(summaryText(120, 340, 4)).toBe("Graph, 120 nodes, 340 connections in 4 kinds.");
    expect(summaryText(1, 1, 1)).toBe("Graph, 1 node, 1 connection in 1 kind.");
  });
});

describe("defaultNodeText", () => {
  it("reads label, kind and connection count", () => {
    expect(
      defaultNodeText("animate", { categoryLabel: "SKILL", connections: 6, selected: false }),
    ).toBe("animate, skill, 6 connections");
  });
});

describe("relationText", () => {
  it("uses the verb outgoing and the inverse verb incoming", () => {
    const uses = cat({ verb: "uses", inverseVerb: "used by" });
    expect(relationText(uses, "out")).toBe("uses");
    expect(relationText(uses, "in")).toBe("used by");
  });

  it("falls back to the label with to / from / with", () => {
    expect(relationText(cat(), "out")).toBe("cites to");
    expect(relationText(cat(), "in")).toBe("cites from");
    expect(relationText(cat(), "both")).toBe("cites with");
  });

  it("reads an undirected category's verb from both ends", () => {
    expect(relationText(cat({ verb: "overlaps", directed: false }), "both")).toBe("overlaps");
  });
});

describe("connectionText", () => {
  const conn = {
    edge: 0,
    other: 1,
    categoryId: "c",
    direction: "out" as const,
    out: true,
    strength: 1,
  };
  const uses = cat({ verb: "uses" });

  it("reads relation, far node, kind and position, marking the first of several as strongest", () => {
    expect(connectionText(uses, conn, "motion-tokens", "TOKEN SET", 1, 6)).toBe(
      "uses motion-tokens, token set. 1 of 6, strongest",
    );
    expect(connectionText(uses, conn, "motion-tokens", "TOKEN SET", 2, 6)).toBe(
      "uses motion-tokens, token set. 2 of 6",
    );
  });

  it("doesn't call a lone connection the strongest", () => {
    expect(connectionText(uses, conn, "x", "y", 1, 1)).toBe("uses x, y. 1 of 1");
  });
});

describe("filterText and detailText", () => {
  it("names the direction filter and its count", () => {
    expect(filterText("out", 4)).toBe("Outgoing, 4 connections");
    expect(filterText("all", 1)).toBe("All connections, 1 connection");
  });

  it("breaks a node's connections down by relation", () => {
    expect(
      detailText("animate", { categoryLabel: "Skill", connections: 6, selected: true }, [
        ["uses", 4],
        ["documented by", 2],
      ]),
    ).toBe("animate. Kind: skill. 6 connections: 4 uses, 2 documented by. Selected.");
    expect(
      detailText("lonely", { categoryLabel: "Skill", connections: 0, selected: false }, []),
    ).toBe("lonely. Kind: skill. 0 connections. Not selected.");
  });
});

describe("describeGraph", () => {
  const nodeCat = (label: string) => ({
    label,
    shape: 0 as const,
    color: "#fff",
    code: "X",
    size: 1,
    charge: 1,
    mass: 1,
    tier: 1,
  });
  const input = {
    nodes: [
      { id: "s2", categoryId: "source", label: "zeta-src" },
      { id: "n1", categoryId: "note", label: "beta" },
      { id: "n2", categoryId: "note", label: "alpha" },
      { id: "t1", categoryId: "tag", label: "#tag" },
    ],
    edges: [
      { a: "n1", b: "s2", categoryId: "cites" },
      { a: "n2", b: "n1", categoryId: "refs" },
      { a: "n2", b: "t1", categoryId: "tagged" },
    ],
    // Declared note → source → tag; the outline keeps this order.
    nodeCategories: { note: nodeCat("NOTE"), source: nodeCat("SOURCE"), tag: nodeCat("TAG") },
    linkCategories: {
      cites: cat({ label: "Cite", verb: "cites", inverseVerb: "cited by", strength: 1 }),
      refs: cat({ label: "Link", strength: 0.5 }),
      tagged: cat({ label: "Tagged", verb: "tagged with", directed: false, strength: 0.8 }),
    },
  };

  it("groups nodes by category in declaration order, sorted by label, with a summary", () => {
    const o = describeGraph(input);
    expect(o.summary).toBe("Graph, 4 nodes, 3 connections in 3 kinds.");
    expect(o.groups.map((g) => [g.label, g.nodes.map((n) => n.label)])).toEqual([
      ["NOTE", ["alpha", "beta"]],
      ["SOURCE", ["zeta-src"]],
      ["TAG", ["#tag"]],
    ]);
  });

  it("reads each connection from the node's side, ranked as the keyboard reads them", () => {
    const beta = describeGraph(input).groups[0]!.nodes[1]!;
    expect(beta.description).toBe("beta, note, 2 connections");
    expect(beta.connections).toEqual([
      { relation: "cites", id: "s2", label: "zeta-src", kind: "source" },
      { relation: "link from", id: "n2", label: "alpha", kind: "note" },
    ]);
    const tag = describeGraph(input).groups[2]!.nodes[0]!;
    expect(tag.connections[0]!.relation).toBe("tagged with");
  });

  it("leaves out hidden categories, and connections to or along them", () => {
    const o = describeGraph({
      ...input,
      hiddenNodeCategories: ["source"],
      hiddenLinkCategories: ["tagged"],
    });
    expect(o.summary).toBe("Graph, 3 nodes, 1 connection in 1 kind.");
    expect(o.groups.map((g) => g.label)).toEqual(["NOTE", "TAG"]);
    expect(o.groups[0]!.nodes[1]!.connections.map((c) => c.label)).toEqual(["alpha"]);
    // The spoken count is the listed one: beta's citation leads to a hidden node.
    expect(o.groups[0]!.nodes[1]!.description).toBe("beta, note, 1 connection");
  });

  it("follows describeNode, rankConnections and invalidEdges like GraphCanvas", () => {
    const o = describeGraph({
      ...input,
      edges: [...input.edges, { a: "n1", b: "gone", categoryId: "refs" }],
      invalidEdges: "drop",
      describeNode: (n) => `NODE ${n.label}`,
      rankConnections: (a, b) => a.other.label.localeCompare(b.other.label),
    });
    const beta = o.groups[0]!.nodes[1]!;
    expect(beta.description).toBe("NODE beta");
    expect(beta.connections.map((c) => c.label)).toEqual(["alpha", "zeta-src"]);
    expect(() =>
      describeGraph({ ...input, edges: [{ a: "n1", b: "gone", categoryId: "refs" }] }),
    ).toThrow(/unknown node id "gone"/);
  });

  it("lists only the isolated node and its direct neighbours, as the canvas draws them", () => {
    const o = describeGraph({ ...input, isolateId: "n1" });
    expect(o.summary).toBe("Graph, 3 nodes, 2 connections in 2 kinds.");
    expect(o.groups.map((g) => [g.label, g.nodes.map((n) => n.label)])).toEqual([
      ["NOTE", ["alpha", "beta"]],
      ["SOURCE", ["zeta-src"]],
    ]);
    // An id that matches nothing isolates nothing, as on the canvas.
    expect(describeGraph({ ...input, isolateId: "nope" }).summary).toMatch(/^Graph, 4 nodes/);
  });

  it("types describeNode and rankConnections with the nodes' own data", () => {
    interface Doc {
      words: number;
    }
    // The same callbacks a GraphCanvas<Doc> takes: no cast to GraphNode<unknown>.
    const describeNode = (n: GraphNode<Doc>) => `${n.label}, ${n.data!.words} words`;
    const nodes: GraphNode<Doc>[] = input.nodes.map((n, i) => ({ ...n, data: { words: i } }));
    const o = describeGraph({
      ...input,
      nodes,
      describeNode,
      rankConnections: (a, b) => a.other.data!.words - b.other.data!.words,
    });
    const beta = o.groups[0]!.nodes[1]!;
    expect(beta.description).toBe("beta, 1 words");
    expect(beta.connections.map((c) => c.label)).toEqual(["zeta-src", "alpha"]);
  });
});
