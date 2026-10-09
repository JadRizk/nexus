import { describe, expect, it } from "vitest";
import { buildConnections, defaultRank, visibleConnections } from "./adjacency.js";
import { initialNavState, lastVisible, navigate } from "./navigator.js";
import type { NavAction, NavContext, NavState } from "./navigator.js";
import type { LinkCategory } from "../types.js";

/*
 * 0:hub — 1:alpha, 2:beta, 3:gamma, and 4:loner on its own.
 *   hub -> alpha (strong), hub -> beta (weak), gamma -> hub (weak)
 * The text callbacks return tags, so each test reads the state machine, not
 * the wording (describe.test.ts covers that).
 */
const cat = (strength: number): LinkCategory => ({
  label: "L",
  color: "#fff",
  width: 1,
  dist: 1,
  strength,
});
const labels = ["hub", "alpha", "beta", "gamma", "loner"];
const lists = buildConnections(
  5,
  Int32Array.from([0, 0, 3]),
  Int32Array.from([1, 2, 0]),
  ["strong", "weak", "weak"],
  { strong: cat(1), weak: cat(0.5) },
  defaultRank(labels, ["strong", "weak"]),
);

function makeCtx(hidden: Set<number> = new Set()): NavContext {
  const isVisible = (i: number) => i >= 0 && i < 5 && !hidden.has(i);
  return {
    connections: (i, f) => visibleConnections(lists[i]!, isVisible, () => true, f),
    allConnections: (i) => lists[i]!,
    isVisible,
    fallback: () => (isVisible(0) ? 0 : ([1, 2, 3, 4].find(isVisible) ?? -1)),
    text: {
      summary: () => "SUMMARY",
      node: (i, sel) => `${labels[i]}${sel ? "*" : ""}`,
      connection: (_i, c, pos, of) => `${labels[c.other]} ${pos}/${of}`,
      filter: (f, k) => `${f}:${k}`,
      detail: (i) => `DETAIL ${labels[i]}`,
      help: "HELP",
    },
  };
}

/** Runs actions in order, returning the final state and every step's effects. */
function run(actions: NavAction[], start = initialNavState(0), ctx = makeCtx()) {
  let s: NavState = start;
  const fx = actions.map((a) => {
    const [next, effects] = navigate(s, a, ctx);
    s = next;
    return effects;
  });
  return { s, fx, last: fx.at(-1)! };
}

describe("entering", () => {
  it("speaks the summary and the node it lands on", () => {
    const { s, last } = run([{ type: "enter" }]);
    expect(s.entered).toBe(true);
    expect(last.announce).toBe("SUMMARY hub");
  });

  it("lands on the selection if there is one", () => {
    const { s, last } = run([{ type: "enter" }], { ...initialNavState(0), selected: 2 });
    expect(s.current).toBe(2);
    expect(last.announce).toBe("SUMMARY beta*");
  });

  it("falls back to the top-ranked node when the last place is hidden", () => {
    const { s } = run([{ type: "enter" }], initialNavState(3), makeCtx(new Set([3])));
    expect(s.current).toBe(0);
  });
});

describe("browsing (← →)", () => {
  it("walks the ranked connections, wrapping, without moving", () => {
    const { s, fx } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
    ]);
    expect(fx.slice(1).map((f) => f.announce)).toEqual([
      "alpha 1/3",
      "beta 2/3",
      "gamma 3/3",
      "alpha 1/3",
    ]);
    expect(s.current).toBe(0);
    expect(fx.some((f) => f.moved)).toBe(false);
  });

  it("starts from the end when browsing backwards", () => {
    const { last } = run([{ type: "enter" }, { type: "browse", step: -1 }]);
    expect(last.announce).toBe("gamma 3/3");
  });

  it("says so when there is nothing to browse", () => {
    const { last } = run([{ type: "enter" }, { type: "browse", step: 1 }], initialNavState(4));
    expect(last.announce).toBe("all:0");
  });
});

describe("direction filter (↑ ↓)", () => {
  it("cycles all → outgoing → incoming and resets the cursor", () => {
    const { s, fx } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "filter", step: 1 },
      { type: "filter", step: 1 },
      { type: "filter", step: 1 },
    ]);
    expect(fx.slice(2).map((f) => f.announce)).toEqual(["out:2", "in:1", "all:3"]);
    expect(s.cursor).toBe(-1);
  });

  it("browses only the filtered connections", () => {
    const { last } = run([
      { type: "enter" },
      { type: "filter", step: -1 },
      { type: "browse", step: 1 },
    ]);
    expect(last.announce).toBe("gamma 1/1");
  });
});

describe("following (Enter) and going back (Backspace)", () => {
  it("follows the connection under the cursor and remembers where it was", () => {
    const { s, last } = run([{ type: "enter" }, { type: "browse", step: 1 }, { type: "follow" }]);
    expect(s.current).toBe(1);
    expect(s.history).toEqual([{ node: 0, selected: false }]);
    expect(last).toMatchObject({ announce: "alpha", moved: true });
  });

  it("asks for a connection first when nothing is under the cursor", () => {
    const { s, last } = run([{ type: "enter" }, { type: "follow" }]);
    expect(s.current).toBe(0);
    expect(last.announce).toMatch(/Choose a connection/);
  });

  it("goes back along the path, and says when the path is used up", () => {
    const { s, fx } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
      { type: "back" },
      { type: "back" },
    ]);
    expect(s.current).toBe(0);
    expect(fx.at(-2)!.announce).toBe("Back to hub");
    expect(fx.at(-1)!.announce).toBe("Start of path");
  });

  it("Home returns to the entry node as a step that can be undone", () => {
    const { s, last } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
      { type: "home" },
    ]);
    expect(s.current).toBe(0);
    expect(s.history).toHaveLength(2);
    expect(last.announce).toBe("Start, hub");
  });
});

describe("selection (Space, Escape) and the mouse", () => {
  it("Space toggles the selection and asks the consumer to apply it", () => {
    const { s, fx } = run([{ type: "enter" }, { type: "toggleSelect" }, { type: "toggleSelect" }]);
    expect(fx[1]).toMatchObject({ announce: "Selected", select: 0 });
    expect(fx[2]).toMatchObject({ announce: "Deselected", select: -1 });
    expect(s.selected).toBe(-1);
  });

  it("Escape deselects first, then leaves", () => {
    const { s, fx } = run([
      { type: "enter" },
      { type: "toggleSelect" },
      { type: "escape" },
      { type: "escape" },
    ]);
    expect(fx[2]).toMatchObject({ select: -1 });
    expect(fx[3]).toMatchObject({ leave: true });
    expect(s.entered).toBe(false);
  });

  it("ignores the echo of its own select effect", () => {
    const { s } = run([
      { type: "enter" },
      { type: "toggleSelect" },
      { type: "selected", index: 0 },
    ]);
    expect(s.history).toEqual([]);
  });

  it("treats a click on another node as a move, and back restores the earlier selection", () => {
    const start = { ...initialNavState(1), selected: 1 };
    const { s, fx } = run(
      [
        { type: "selected", index: 2 },
        { type: "selected", index: 3 },
        { type: "back" },
        { type: "back" },
      ],
      start,
    );
    expect(fx[2]).toMatchObject({ select: 2 });
    expect(fx[3]).toMatchObject({ select: 1 });
    expect(s).toMatchObject({ current: 1, selected: 1, history: [] });
  });

  it("treats clearing the selection as a move back can undo", () => {
    const start = { ...initialNavState(2), selected: 2 };
    const { s, last } = run([{ type: "selected", index: -1 }, { type: "back" }], start);
    expect(last.select).toBe(2);
    expect(s.selected).toBe(2);
  });

  it("doesn't touch the selection when going back over keyboard steps", () => {
    const { last } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
      { type: "back" },
    ]);
    expect(last.select).toBeUndefined();
  });
});

describe("describe and help", () => {
  it("speak without changing anything", () => {
    const start = run([{ type: "enter" }]).s;
    const d = navigate(start, { type: "describe" }, makeCtx());
    const h = navigate(start, { type: "help" }, makeCtx());
    expect(d).toEqual([start, { announce: "DETAIL hub" }]);
    expect(h).toEqual([start, { announce: "HELP" }]);
  });
});

describe("when the current node is hidden", () => {
  it("moves to the nearest visible place in the history and says so", () => {
    const walked = run([{ type: "enter" }, { type: "browse", step: 1 }, { type: "follow" }]).s;
    const [s, fx] = navigate(walked, { type: "visibility" }, makeCtx(new Set([1])));
    expect(s.current).toBe(0);
    expect(fx).toMatchObject({ announce: "Moved to hub", moved: true });
  });

  it("falls back to the selection, then the top-ranked node", () => {
    const sel = { ...initialNavState(3), entered: true, selected: 2 };
    expect(navigate(sel, { type: "visibility" }, makeCtx(new Set([3])))[0].current).toBe(2);
    const none = { ...initialNavState(3), entered: true };
    expect(navigate(none, { type: "visibility" }, makeCtx(new Set([3])))[0].current).toBe(0);
  });

  it("only resets the cursor when the current node is still visible", () => {
    const browsing = run([{ type: "enter" }, { type: "browse", step: 1 }]).s;
    const [s, fx] = navigate(browsing, { type: "visibility" }, makeCtx());
    expect(s).toMatchObject({ current: 0, cursor: -1 });
    expect(fx).toEqual({});
  });

  it("keeps the cursor on the same edge when the list changes under it", () => {
    // On hub's second connection, beta (edge 1). Hiding alpha moves beta to first.
    const onBeta = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
    ]).s;
    expect(onBeta.cursor).toBe(1);
    const [kept] = navigate(onBeta, { type: "visibility", edge: 1 }, makeCtx(new Set([1])));
    expect(kept.cursor).toBe(0);
    // And starts over when that edge is gone.
    const [gone] = navigate(onBeta, { type: "visibility", edge: 1 }, makeCtx(new Set([2])));
    expect(gone.cursor).toBe(-1);
  });

  it("moves the Home point to the reader when a filter hides it", () => {
    const walked = run([{ type: "enter" }, { type: "browse", step: 1 }, { type: "follow" }]).s;
    const ctx = makeCtx(new Set([0]));
    const [s] = navigate(walked, { type: "visibility" }, ctx);
    expect(s).toMatchObject({ current: 1, start: 1 });
    expect(navigate(s, { type: "home" }, ctx)[1].announce).toBe("alpha");
  });
});

describe("going back past hidden places", () => {
  it("skips steps to nodes a filter has since hidden", () => {
    // hub → alpha → hub, then alpha is hidden.
    const walked = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
      { type: "browse", step: 1 },
      { type: "follow" },
    ]).s;
    expect(walked.history.map((h) => h.node)).toEqual([0, 1]);
    const [s, fx] = navigate(walked, { type: "back" }, makeCtx(new Set([1])));
    expect(s).toMatchObject({ current: 0, history: [] });
    expect(fx.announce).toBe("Back to hub");
  });

  it("is the start of the path when every earlier step is hidden, and keeps them", () => {
    const walked = run([{ type: "enter" }, { type: "browse", step: 1 }, { type: "follow" }]).s;
    const [s, fx] = navigate(walked, { type: "back" }, makeCtx(new Set([0])));
    expect(s).toBe(walked);
    expect(fx.announce).toBe("Start of path");
    // Once the filter lifts, the step is there to go back to.
    expect(navigate(s, { type: "back" }, makeCtx())[0].current).toBe(0);
  });

  it("lastVisible finds the newest visible step, or -1", () => {
    const history = [
      { node: 0, selected: false },
      { node: 1, selected: false },
    ];
    expect(lastVisible(history, makeCtx())).toBe(1);
    expect(lastVisible(history, makeCtx(new Set([1])))).toBe(0);
    expect(lastVisible(history, makeCtx(new Set([0, 1])))).toBe(-1);
  });
});

describe("focusNode (controller.focusNode)", () => {
  it("puts the reader on the node as a step back can undo", () => {
    const { s, last } = run([{ type: "focusNode", index: 3 }]);
    expect(s).toMatchObject({ current: 3, entered: true, history: [{ node: 0, selected: false }] });
    expect(last).toMatchObject({ announce: "gamma", moved: true });
  });

  it("ignores a hidden node", () => {
    const [s, fx] = navigate(
      initialNavState(0),
      { type: "focusNode", index: 3 },
      makeCtx(new Set([3])),
    );
    expect(s.current).toBe(0);
    expect(fx).toEqual({});
  });

  it("only announces when already on that node", () => {
    const { s, last } = run([{ type: "focusNode", index: 0 }]);
    expect(s.history).toEqual([]);
    expect(last.moved).toBeUndefined();
  });
});
