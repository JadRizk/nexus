import type { DirectionFilter, NavConnection } from "./adjacency.js";

export interface HistoryEntry {
  node: number;
  selected: boolean;
}

export interface NavState {
  entered: boolean;
  current: number;
  /** Home returns here. Moves to `current` if a filter hides it. */
  start: number;
  /** Index into `current`'s visible connections under `filter`, or -1 before browsing. */
  cursor: number;
  filter: DirectionFilter;
  history: HistoryEntry[];
  /** -1 for none. Mirrors the consumer's selectedId. */
  selected: number;
}

export interface NavContext {
  /** Visible connections that pass `filter`, ranked. */
  connections(node: number, filter: DirectionFilter): NavConnection[];
  /** All connections, visible or not, ranked. */
  allConnections(node: number): NavConnection[];
  isVisible(node: number): boolean;
  /** The top-ranked visible node, or -1 if none. */
  fallback(): number;
  text: {
    summary(): string;
    node(node: number, selected: boolean): string;
    connection(node: number, connection: NavConnection, position: number, of: number): string;
    filter(filter: DirectionFilter, count: number): string;
    detail(node: number, selected: boolean): string;
    help: string;
  };
}

export type NavAction =
  | { type: "enter" }
  | { type: "browse"; step: 1 | -1 }
  | { type: "filter"; step: 1 | -1 }
  | { type: "follow" }
  | { type: "toggleSelect" }
  | { type: "back" }
  | { type: "home" }
  | { type: "describe" }
  | { type: "help" }
  | { type: "escape" }
  /** The selection changed from outside the navigator. */
  | { type: "selected"; index: number }
  /** `edge` is the edge under the cursor before the change, so the cursor can stay on it. */
  | { type: "visibility"; edge?: number }
  | { type: "focusNode"; index: number };

export interface NavEffects {
  announce?: string;
  /** -1 clears the selection. */
  select?: number;
  leave?: boolean;
  moved?: boolean;
}

const FILTERS = ["all", "out", "in"] as const satisfies readonly DirectionFilter[];

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

function goTo(state: NavState, node: number): NavState {
  return {
    ...state,
    history: [
      ...state.history,
      { node: state.current, selected: state.selected === state.current },
    ],
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

const NEEDS_NODE = new Set<NavAction["type"]>([
  "browse",
  "filter",
  "follow",
  "toggleSelect",
  "home",
  "describe",
]);

/** Pure reducer: the DOM layer carries out the returned effects. History is shared with mouse selection. */
export function navigate(
  state: NavState,
  action: NavAction,
  ctx: NavContext,
): [NavState, NavEffects] {
  // An empty or fully filtered graph has no node to stand on, so say what there is instead.
  if (state.current < 0 && NEEDS_NODE.has(action.type))
    return [state, { announce: ctx.text.summary() }];
  const list = () => ctx.connections(state.current, state.filter);

  switch (action.type) {
    case "enter": {
      let landing =
        state.selected >= 0 && ctx.isVisible(state.selected) ? state.selected : state.current;
      if (landing < 0 || !ctx.isVisible(landing)) landing = ctx.fallback();
      if (landing < 0) return [state, { announce: ctx.text.summary() }];
      const next = {
        ...state,
        entered: true,
        current: landing,
        start: landing,
        cursor: -1,
        filter: "all" as const,
      };
      return [
        next,
        {
          announce: `${ctx.text.summary()} ${ctx.text.node(landing, state.selected === landing)}`,
          moved: landing !== state.current,
        },
      ];
    }

    case "browse": {
      const connections = list();
      if (connections.length === 0) return [state, { announce: ctx.text.filter(state.filter, 0) }];
      const cursor =
        state.cursor < 0
          ? action.step > 0
            ? 0
            : connections.length - 1
          : (state.cursor + action.step + connections.length) % connections.length;
      return [
        { ...state, cursor },
        {
          announce: ctx.text.connection(
            state.current,
            connections[cursor]!,
            cursor + 1,
            connections.length,
          ),
        },
      ];
    }

    case "filter": {
      const filter =
        FILTERS[(FILTERS.indexOf(state.filter) + action.step + FILTERS.length) % FILTERS.length]!;
      const next = { ...state, filter, cursor: -1 };
      return [
        next,
        { announce: ctx.text.filter(filter, ctx.connections(state.current, filter).length) },
      ];
    }

    case "follow": {
      const connection = state.cursor >= 0 ? list()[state.cursor] : undefined;
      if (!connection)
        return [state, { announce: "Choose a connection first, with the left or right arrow" }];
      const next = goTo(state, connection.other);
      return [
        next,
        {
          announce: ctx.text.node(connection.other, state.selected === connection.other),
          moved: true,
        },
      ];
    }

    case "toggleSelect": {
      if (state.selected === state.current)
        return [
          { ...state, selected: -1 },
          { announce: "Deselected", select: -1 },
        ];
      return [
        { ...state, selected: state.current },
        { announce: "Selected", select: state.current },
      ];
    }

    case "back": {
      // Skip steps a filter has since hidden; with none visible, history is kept for when it lifts.
      const historyIndex = lastVisible(state.history, ctx);
      const entry = state.history[historyIndex];
      if (!entry) return [state, { announce: "Start of path" }];
      const next: NavState = {
        ...state,
        history: state.history.slice(0, historyIndex),
        current: entry.node,
        cursor: -1,
        filter: "all",
      };
      const effects: NavEffects = { moved: entry.node !== state.current };
      const wantSelected = entry.selected ? entry.node : -1;
      if (wantSelected !== state.selected) {
        next.selected = wantSelected;
        effects.select = wantSelected;
      }
      effects.announce = `Back to ${ctx.text.node(entry.node, next.selected === entry.node)}`;
      return [next, effects];
    }

    case "home": {
      if (state.current === state.start)
        return [state, { announce: ctx.text.node(state.start, state.selected === state.start) }];
      const next = goTo(state, state.start);
      return [
        next,
        {
          announce: `Start, ${ctx.text.node(state.start, state.selected === state.start)}`,
          moved: true,
        },
      ];
    }

    case "describe":
      return [
        state,
        { announce: ctx.text.detail(state.current, state.selected === state.current) },
      ];

    case "help":
      return [state, { announce: ctx.text.help }];

    case "escape": {
      if (state.selected >= 0)
        return [
          { ...state, selected: -1 },
          { announce: "Deselected", select: -1 },
        ];
      return [{ ...state, entered: false, cursor: -1 }, { leave: true }];
    }

    case "selected": {
      // Echoes of the navigator's own select effects arrive here and change nothing.
      if (action.index === state.selected) return [state, {}];
      const history = [
        ...state.history,
        { node: state.current, selected: state.selected === state.current },
      ];
      if (action.index < 0) return [{ ...state, selected: -1, history }, {}];
      return [
        {
          ...state,
          selected: action.index,
          current: action.index,
          cursor: -1,
          filter: "all",
          history,
        },
        { moved: action.index !== state.current },
      ];
    }

    case "focusNode": {
      if (!ctx.isVisible(action.index)) return [state, {}];
      const entered = { ...state, entered: true };
      if (action.index === state.current)
        return [
          entered,
          { announce: ctx.text.node(state.current, state.selected === state.current) },
        ];
      const next = { ...goTo(state, action.index), entered: true };
      return [
        next,
        { announce: ctx.text.node(action.index, state.selected === action.index), moved: true },
      ];
    }

    case "visibility": {
      if (state.current >= 0 && ctx.isVisible(state.current)) {
        const cursor =
          action.edge === undefined
            ? -1
            : ctx
                .connections(state.current, state.filter)
                .findIndex((connection) => connection.edge === action.edge);
        return [
          { ...state, cursor, start: ctx.isVisible(state.start) ? state.start : state.current },
          {},
        ];
      }
      // The current node is gone: land somewhere visible and say so, so focus never silently drops.
      const fromHistory = [...state.history]
        .reverse()
        .find((entry) => ctx.isVisible(entry.node))?.node;
      const target =
        fromHistory ??
        (state.selected >= 0 && ctx.isVisible(state.selected) ? state.selected : ctx.fallback());
      if (target === undefined || target < 0) return [{ ...state, cursor: -1 }, {}];
      const next = {
        ...state,
        current: target,
        start: ctx.isVisible(state.start) ? state.start : target,
        cursor: -1,
        filter: "all" as const,
      };
      return [
        next,
        state.entered
          ? {
              announce: `Moved to ${ctx.text.node(target, state.selected === target)}`,
              moved: true,
            }
          : { moved: true },
      ];
    }
  }
}
