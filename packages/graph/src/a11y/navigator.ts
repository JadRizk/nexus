/* ============================================================================
   NAVIGATOR — the keyboard / screen-reader model, as a pure reducer

   `navigate(state, action, ctx)` returns the next state and the effects the
   DOM layer should carry out (announce, select, leave). No DOM, no timers, so
   every key in the spec's key map (§6.5.1) is a unit test, and the key map
   can change after testing with real screen-reader users without touching
   rendering.

   The model is QUARTZ's (ASSETS '26): one entry point that speaks a summary,
   then travel along connections — browse a node's connections without moving
   (← →), narrow them by direction (↑ ↓), follow one (Enter), and go back
   (Backspace). Tabbing node by node in DOM order is what the study found
   disorienting; a graph has no reading order to tab through.

   History is shared with the mouse. Each entry is where the reader was and
   whether it was selected then; following a connection, clicking another
   node and clearing a selection all push one. `back` restores both, so a
   consumer's Back button and the Backspace key are the same action.
   ========================================================================== */

import type { DirectionFilter, NavConnection } from "./adjacency.js";

export interface HistoryEntry {
  node: number;
  selected: boolean;
}

export interface NavState {
  /** True once focus has entered the graph and the summary has been spoken. */
  entered: boolean;
  /** The node the reader is on. */
  current: number;
  /** Where the reader entered; Home returns here. Moves to the reader if a filter hides it. */
  start: number;
  /** Index into `current`'s visible connections under `filter`, or -1 before browsing. */
  cursor: number;
  filter: DirectionFilter;
  history: HistoryEntry[];
  /** The selected node, or -1. Mirrors the consumer's selectedId. */
  selected: number;
}

/** Everything the reducer needs to know about the graph and how to word it. */
export interface NavContext {
  /** `i`'s connections that are visible and pass `filter`, ranked. */
  connections(i: number, filter: DirectionFilter): NavConnection[];
  /** All of `i`'s connections, visible or not, ranked. */
  allConnections(i: number): NavConnection[];
  isVisible(i: number): boolean;
  /** The best visible node to land on when there is nowhere better: the top-ranked one, or -1 if none. */
  fallback(): number;
  text: {
    summary(): string;
    node(i: number, selected: boolean): string;
    connection(i: number, c: NavConnection, position: number, of: number): string;
    filter(f: DirectionFilter, count: number): string;
    detail(i: number, selected: boolean): string;
    help: string;
  };
}

export type NavAction =
  /** Focus entered the graph. */
  | { type: "enter" }
  /** ← / →: move the cursor along the current node's connections. */
  | { type: "browse"; step: 1 | -1 }
  /** ↑ / ↓: cycle the direction filter. */
  | { type: "filter"; step: 1 | -1 }
  /** Enter: go to the node under the cursor. */
  | { type: "follow" }
  /** Space: select or deselect the current node. */
  | { type: "toggleSelect" }
  /** Backspace, or controller.back(). */
  | { type: "back" }
  /** Home: back to where the reader entered. */
  | { type: "home" }
  /** D: describe the current node in detail. */
  | { type: "describe" }
  /** ?: speak the key map. */
  | { type: "help" }
  /** Escape: deselect, else leave the graph. */
  | { type: "escape" }
  /** The selection changed from outside the navigator (a click, or the consumer). */
  | { type: "selected"; index: number }
  /**
   * Filters, isolation or a selection-scoped category changed what is
   * visible. `edge` is the edge under the cursor before the change, so the
   * cursor can stay on it in the list as it now reads.
   */
  | { type: "visibility"; edge?: number }
  /** controller.focusNode(): put the reader on a node, e.g. from a search box. */
  | { type: "focusNode"; index: number };

export interface NavEffects {
  /** Text for the live region. */
  announce?: string;
  /** Ask the consumer to select this node, or clear the selection with -1. */
  select?: number;
  /** Focus should leave the graph. */
  leave?: boolean;
  /** `current` changed; the camera may want to follow. */
  moved?: boolean;
}

const FILTERS: DirectionFilter[] = ["all", "out", "in"];

export function initialNavState(start: number): NavState {
  return {
    entered: false,
    current: start,
    start,
    cursor: -1,
    filter: "all",
    history: [],
    selected: -1,
  };
}

/** Moves to `node`, remembering where the reader was. Resets browsing. */
function goTo(s: NavState, node: number): NavState {
  return {
    ...s,
    history: [...s.history, { node: s.current, selected: s.selected === s.current }],
    current: node,
    cursor: -1,
    filter: "all",
  };
}

/** Index of the newest history entry whose node is visible, or -1. */
export function lastVisible(history: readonly HistoryEntry[], ctx: Pick<NavContext, "isVisible">) {
  for (let k = history.length - 1; k >= 0; k--) if (ctx.isVisible(history[k]!.node)) return k;
  return -1;
}

export function navigate(s: NavState, action: NavAction, ctx: NavContext): [NavState, NavEffects] {
  const list = () => ctx.connections(s.current, s.filter);

  switch (action.type) {
    case "enter": {
      // Land on the selection if there is one, else where the reader last
      // was (if still visible), else the top-ranked node.
      let at = s.selected >= 0 && ctx.isVisible(s.selected) ? s.selected : s.current;
      if (at < 0 || !ctx.isVisible(at)) at = ctx.fallback();
      if (at < 0) return [s, { announce: ctx.text.summary() }];
      const next = {
        ...s,
        entered: true,
        current: at,
        start: at,
        cursor: -1,
        filter: "all" as const,
      };
      return [
        next,
        {
          announce: `${ctx.text.summary()} ${ctx.text.node(at, s.selected === at)}`,
          moved: at !== s.current,
        },
      ];
    }

    case "browse": {
      const l = list();
      if (l.length === 0) return [s, { announce: ctx.text.filter(s.filter, 0) }];
      const i =
        s.cursor < 0
          ? action.step > 0
            ? 0
            : l.length - 1
          : (s.cursor + action.step + l.length) % l.length;
      return [
        { ...s, cursor: i },
        { announce: ctx.text.connection(s.current, l[i]!, i + 1, l.length) },
      ];
    }

    case "filter": {
      const f =
        FILTERS[(FILTERS.indexOf(s.filter) + action.step + FILTERS.length) % FILTERS.length]!;
      const next = { ...s, filter: f, cursor: -1 };
      return [next, { announce: ctx.text.filter(f, ctx.connections(s.current, f).length) }];
    }

    case "follow": {
      const c = s.cursor >= 0 ? list()[s.cursor] : undefined;
      if (!c) return [s, { announce: "Choose a connection first, with the left or right arrow" }];
      const next = goTo(s, c.other);
      return [next, { announce: ctx.text.node(c.other, s.selected === c.other), moved: true }];
    }

    case "toggleSelect": {
      if (s.selected === s.current)
        return [
          { ...s, selected: -1 },
          { announce: "Deselected", select: -1 },
        ];
      return [
        { ...s, selected: s.current },
        { announce: "Selected", select: s.current },
      ];
    }

    case "back": {
      // Steps to places a filter has since hidden are skipped: going back
      // never parks the reader on a node that isn't drawn.
      const at = lastVisible(s.history, ctx);
      const entry = s.history[at];
      // Steps that are only hidden stay: lifting the filter brings them back.
      if (!entry) return [s, { announce: "Start of path" }];
      const next: NavState = {
        ...s,
        history: s.history.slice(0, at),
        current: entry.node,
        cursor: -1,
        filter: "all",
      };
      const effects: NavEffects = { moved: entry.node !== s.current };
      // Restore the selection the reader had there.
      const wantSelected = entry.selected ? entry.node : -1;
      if (wantSelected !== s.selected) {
        next.selected = wantSelected;
        effects.select = wantSelected;
      }
      effects.announce = `Back to ${ctx.text.node(entry.node, next.selected === entry.node)}`;
      return [next, effects];
    }

    case "home": {
      if (s.current === s.start)
        return [s, { announce: ctx.text.node(s.start, s.selected === s.start) }];
      const next = goTo(s, s.start);
      return [
        next,
        { announce: `Start, ${ctx.text.node(s.start, s.selected === s.start)}`, moved: true },
      ];
    }

    case "describe":
      return [s, { announce: ctx.text.detail(s.current, s.selected === s.current) }];

    case "help":
      return [s, { announce: ctx.text.help }];

    case "escape": {
      if (s.selected >= 0)
        return [
          { ...s, selected: -1 },
          { announce: "Deselected", select: -1 },
        ];
      return [{ ...s, entered: false, cursor: -1 }, { leave: true }];
    }

    case "selected": {
      // Echoes of the navigator's own select effects come back through here
      // as the consumer updates selectedId; they change nothing.
      if (action.index === s.selected) return [s, {}];
      const history = [...s.history, { node: s.current, selected: s.selected === s.current }];
      if (action.index < 0) return [{ ...s, selected: -1, history }, {}];
      return [
        { ...s, selected: action.index, current: action.index, cursor: -1, filter: "all", history },
        { moved: action.index !== s.current },
      ];
    }

    case "focusNode": {
      if (!ctx.isVisible(action.index)) return [s, {}];
      const entered = { ...s, entered: true };
      if (action.index === s.current)
        return [entered, { announce: ctx.text.node(s.current, s.selected === s.current) }];
      const next = { ...goTo(s, action.index), entered: true };
      return [
        next,
        { announce: ctx.text.node(action.index, s.selected === action.index), moved: true },
      ];
    }

    case "visibility": {
      if (s.current >= 0 && ctx.isVisible(s.current)) {
        // The cursor indexes a list that may have changed under it: keep it
        // on the same edge if that is still listed, else start over.
        const cursor =
          action.edge === undefined
            ? -1
            : ctx.connections(s.current, s.filter).findIndex((c) => c.edge === action.edge);
        return [{ ...s, cursor, start: ctx.isVisible(s.start) ? s.start : s.current }, {}];
      }
      // The node the reader was on is gone. Land on the nearest visible place
      // they have been, then the selection, then the top-ranked node, and say
      // so — focus never silently falls off the graph.
      const fromHistory = [...s.history].reverse().find((h) => ctx.isVisible(h.node))?.node;
      const to =
        fromHistory ?? (s.selected >= 0 && ctx.isVisible(s.selected) ? s.selected : ctx.fallback());
      if (to === undefined || to < 0) return [{ ...s, cursor: -1 }, {}];
      const next = {
        ...s,
        current: to,
        start: ctx.isVisible(s.start) ? s.start : to,
        cursor: -1,
        filter: "all" as const,
      };
      return [
        next,
        s.entered
          ? { announce: `Moved to ${ctx.text.node(to, s.selected === to)}`, moved: true }
          : { moved: true },
      ];
    }
  }
}
