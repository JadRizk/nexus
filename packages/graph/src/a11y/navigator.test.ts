import { describe, expect, it } from "vitest";
import { buildConnections, defaultRank, visibleConnections } from "./adjacency.js";
import { initialNavState, lastVisible, navigate } from "./navigator.js";
import type { NavAction, NavContext, NavState } from "./navigator.js";
import type { LinkCategory } from "../types.js";

// hub -> alpha (strong), hub -> beta (weak), gamma -> hub (weak); loner has no edges.
// The text callbacks return tags, so tests read the state machine, not the wording.
const linkCategory = (strength: number): LinkCategory => ({
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
  { strong: linkCategory(1), weak: linkCategory(0.5) },
  defaultRank(labels, ["strong", "weak"]),
);

function makeCtx(hidden: Set<number> = new Set()): NavContext {
  const isVisible = (node: number) => node >= 0 && node < 5 && !hidden.has(node);
  return {
    connections: (node, filter) => visibleConnections(lists[node], isVisible, () => true, filter),
    allConnections: (node) => lists[node],
    isVisible,
    fallback: () => (isVisible(0) ? 0 : ([1, 2, 3, 4].find(isVisible) ?? -1)),
    text: {
      summary: () => "SUMMARY",
      node: (node, isSelected) => `${labels[node]}${isSelected ? "*" : ""}`,
      connection: (_node, connection, position, total) =>
        `${labels[connection.other]} ${position}/${total}`,
      filter: (filter, count) => `${filter}:${count}`,
      detail: (node) => `DETAIL ${labels[node]}`,
      help: "HELP",
    },
  };
}

/** Runs actions in order, returning the final state and every step's effects. */
function run(actions: NavAction[], start = initialNavState(0), ctx = makeCtx()) {
  let state: NavState = start;
  const effects = actions.map((action) => {
    const [next, stepEffects] = navigate(state, action, ctx);
    state = next;
    return stepEffects;
  });
  return { state, effects, last: effects.at(-1)! };
}

describe("entering", () => {
  it("speaks the summary and the node it lands on", () => {
    const { state, last } = run([{ type: "enter" }]);
    expect(state.entered).toBe(true);
    expect(last.announce).toBe("SUMMARY hub");
  });

  it("lands on the selection if there is one", () => {
    const { state, last } = run([{ type: "enter" }], { ...initialNavState(0), selected: 2 });
    expect(state.current).toBe(2);
    expect(last.announce).toBe("SUMMARY beta*");
  });

  it("falls back to the top-ranked node when the last place is hidden", () => {
    const { state } = run([{ type: "enter" }], initialNavState(3), makeCtx(new Set([3])));
    expect(state.current).toBe(0);
  });
});

describe("browsing (← →)", () => {
  it("walks the ranked connections, wrapping, without moving", () => {
    const { state, effects } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
    ]);
    expect(effects.slice(1).map((effect) => effect.announce)).toEqual([
      "alpha 1/3",
      "beta 2/3",
      "gamma 3/3",
      "alpha 1/3",
    ]);
    expect(state.current).toBe(0);
    expect(effects.some((effect) => effect.moved)).toBe(false);
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
    const { state, effects } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "filter", step: 1 },
      { type: "filter", step: 1 },
      { type: "filter", step: 1 },
    ]);
    expect(effects.slice(2).map((effect) => effect.announce)).toEqual(["out:2", "in:1", "all:3"]);
    expect(state.cursor).toBe(-1);
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
    const { state, last } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
    ]);
    expect(state.current).toBe(1);
    expect(state.history).toEqual([{ node: 0, selected: false }]);
    expect(last).toMatchObject({ announce: "alpha", moved: true });
  });

  it("asks for a connection first when nothing is under the cursor", () => {
    const { state, last } = run([{ type: "enter" }, { type: "follow" }]);
    expect(state.current).toBe(0);
    expect(last.announce).toMatch(/Choose a connection/);
  });

  it("goes back along the path, and says when the path is used up", () => {
    const { state, effects } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
      { type: "back" },
      { type: "back" },
    ]);
    expect(state.current).toBe(0);
    expect(effects.at(-2)!.announce).toBe("Back to hub");
    expect(effects.at(-1)!.announce).toBe("Start of path");
  });

  it("Home returns to the entry node as a step that can be undone", () => {
    const { state, last } = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
      { type: "home" },
    ]);
    expect(state.current).toBe(0);
    expect(state.history).toHaveLength(2);
    expect(last.announce).toBe("Start, hub");
  });
});

describe("selection (Space, Escape) and the mouse", () => {
  it("Space toggles the selection and asks the consumer to apply it", () => {
    const { state, effects } = run([
      { type: "enter" },
      { type: "toggleSelect" },
      { type: "toggleSelect" },
    ]);
    expect(effects[1]).toMatchObject({ announce: "Selected", select: 0 });
    expect(effects[2]).toMatchObject({ announce: "Deselected", select: -1 });
    expect(state.selected).toBe(-1);
  });

  it("Escape deselects first, then leaves", () => {
    const { state, effects } = run([
      { type: "enter" },
      { type: "toggleSelect" },
      { type: "escape" },
      { type: "escape" },
    ]);
    expect(effects[2]).toMatchObject({ select: -1 });
    expect(effects[3]).toMatchObject({ leave: true });
    expect(state.entered).toBe(false);
  });

  it("ignores the echo of its own select effect", () => {
    const { state } = run([
      { type: "enter" },
      { type: "toggleSelect" },
      { type: "selected", index: 0 },
    ]);
    expect(state.history).toEqual([]);
  });

  it("treats a click on another node as a move, and back restores the earlier selection", () => {
    const start = { ...initialNavState(1), selected: 1 };
    const { state, effects } = run(
      [
        { type: "selected", index: 2 },
        { type: "selected", index: 3 },
        { type: "back" },
        { type: "back" },
      ],
      start,
    );
    expect(effects[2]).toMatchObject({ select: 2 });
    expect(effects[3]).toMatchObject({ select: 1 });
    expect(state).toMatchObject({ current: 1, selected: 1, history: [] });
  });

  it("treats clearing the selection as a move back can undo", () => {
    const start = { ...initialNavState(2), selected: 2 };
    const { state, last } = run([{ type: "selected", index: -1 }, { type: "back" }], start);
    expect(last.select).toBe(2);
    expect(state.selected).toBe(2);
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
    const start = run([{ type: "enter" }]).state;
    const described = navigate(start, { type: "describe" }, makeCtx());
    const helped = navigate(start, { type: "help" }, makeCtx());
    expect(described).toEqual([start, { announce: "DETAIL hub" }]);
    expect(helped).toEqual([start, { announce: "HELP" }]);
  });
});

describe("when the current node is hidden", () => {
  it("moves to the nearest visible place in the history and says so", () => {
    const walked = run([{ type: "enter" }, { type: "browse", step: 1 }, { type: "follow" }]).state;
    const [state, effects] = navigate(walked, { type: "visibility" }, makeCtx(new Set([1])));
    expect(state.current).toBe(0);
    expect(effects).toMatchObject({ announce: "Moved to hub", moved: true });
  });

  it("falls back to the selection, then the top-ranked node", () => {
    const withSelection = { ...initialNavState(3), entered: true, selected: 2 };
    expect(navigate(withSelection, { type: "visibility" }, makeCtx(new Set([3])))[0].current).toBe(
      2,
    );
    const none = { ...initialNavState(3), entered: true };
    expect(navigate(none, { type: "visibility" }, makeCtx(new Set([3])))[0].current).toBe(0);
  });

  it("only resets the cursor when the current node is still visible", () => {
    const browsing = run([{ type: "enter" }, { type: "browse", step: 1 }]).state;
    const [state, effects] = navigate(browsing, { type: "visibility" }, makeCtx());
    expect(state).toMatchObject({ current: 0, cursor: -1 });
    expect(effects).toEqual({});
  });

  it("keeps the cursor on the same edge when the list changes under it", () => {
    // On hub's second connection, beta (edge 1); hiding alpha moves beta to first.
    const onBeta = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "browse", step: 1 },
    ]).state;
    expect(onBeta.cursor).toBe(1);
    const [kept] = navigate(onBeta, { type: "visibility", edge: 1 }, makeCtx(new Set([1])));
    expect(kept.cursor).toBe(0);
    const [gone] = navigate(onBeta, { type: "visibility", edge: 1 }, makeCtx(new Set([2])));
    expect(gone.cursor).toBe(-1);
  });

  it("moves the Home point to the reader when a filter hides it", () => {
    const walked = run([{ type: "enter" }, { type: "browse", step: 1 }, { type: "follow" }]).state;
    const ctx = makeCtx(new Set([0]));
    const [state] = navigate(walked, { type: "visibility" }, ctx);
    expect(state).toMatchObject({ current: 1, start: 1 });
    expect(navigate(state, { type: "home" }, ctx)[1].announce).toBe("alpha");
  });
});

describe("with no node to stand on", () => {
  it("says what there is instead of reading a node that isn't there", () => {
    const empty = { ...initialNavState(-1), entered: true };
    for (const action of [
      { type: "browse", step: 1 },
      { type: "filter", step: 1 },
      { type: "follow" },
      { type: "toggleSelect" },
      { type: "home" },
      { type: "describe" },
    ] as NavAction[]) {
      const [state, effects] = navigate(empty, action, makeCtx(new Set([0, 1, 2, 3, 4])));
      expect(state).toBe(empty);
      expect(effects).toEqual({ announce: "SUMMARY" });
    }
  });

  it("lands on a node once a filter lifts", () => {
    const empty = { ...initialNavState(-1), entered: true };
    const [state, effects] = navigate(empty, { type: "visibility" }, makeCtx());
    expect(state.current).toBe(0);
    expect(effects).toMatchObject({ announce: "Moved to hub", moved: true });
  });
});

describe("going back past hidden places", () => {
  it("skips steps to nodes a filter has since hidden", () => {
    const walked = run([
      { type: "enter" },
      { type: "browse", step: 1 },
      { type: "follow" },
      { type: "browse", step: 1 },
      { type: "follow" },
    ]).state;
    expect(walked.history.map((step) => step.node)).toEqual([0, 1]);
    const [state, effects] = navigate(walked, { type: "back" }, makeCtx(new Set([1])));
    expect(state).toMatchObject({ current: 0, history: [] });
    expect(effects.announce).toBe("Back to hub");
  });

  it("is the start of the path when every earlier step is hidden, and keeps them", () => {
    const walked = run([{ type: "enter" }, { type: "browse", step: 1 }, { type: "follow" }]).state;
    const [state, effects] = navigate(walked, { type: "back" }, makeCtx(new Set([0])));
    expect(state).toBe(walked);
    expect(effects.announce).toBe("Start of path");
    expect(navigate(state, { type: "back" }, makeCtx())[0].current).toBe(0);
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
    const { state, last } = run([{ type: "focusNode", index: 3 }]);
    expect(state).toMatchObject({
      current: 3,
      entered: true,
      history: [{ node: 0, selected: false }],
    });
    expect(last).toMatchObject({ announce: "gamma", moved: true });
  });

  it("ignores a hidden node", () => {
    const [state, effects] = navigate(
      initialNavState(0),
      { type: "focusNode", index: 3 },
      makeCtx(new Set([3])),
    );
    expect(state.current).toBe(0);
    expect(effects).toEqual({});
  });

  it("only announces when already on that node", () => {
    const { state, last } = run([{ type: "focusNode", index: 0 }]);
    expect(state.history).toEqual([]);
    expect(last.moved).toBeUndefined();
  });
});
