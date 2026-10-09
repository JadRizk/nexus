import type { CSSProperties } from "react";
import type { FitInset, Viewport } from "./camera.js";
import type { DroppedEdge, InvalidEdgePolicy } from "./validate.js";
import type { DescribeContext } from "./describe.js";

/* ============================================================================
   Public types for @nexus-cyberdeck/graph.

   The prototype this was extracted from hardcoded one taxonomy (ATLAS/TAG/
   UNRSLV/SOURCE/AGENT/NODE, refs/cites/tagged/mentions/contradicts) directly
   into the engine via module-global `NODE_TYPES`/`LINK_TYPES` lookup tables
   keyed by a `.type` string. Everything here replaces that with a generic
   category system: nodes/edges carry a `categoryId`, and the caller supplies
   `nodeCategories`/`linkCategories` maps describing how each category looks
   and behaves. The showcase's ATLAS/TAG/etc. vocabulary becomes sample data
   built from these types, not part of the package.
   ========================================================================== */

/** Index into the six SDF node shapes the shader supports — same order @nexus-cyberdeck/react's `GLYPH_SHAPES` uses (circle, hexagon, diamond, ring, square, triangle). */
export type GlyphShapeIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** 0=DORMANT · 1=STABLE · 2=HOT (breathing/flicker in the node shader) · 3=ORPHAN (dimmed). */
export type NodeState = 0 | 1 | 2 | 3;
export const STATE_LABEL = ["DORMANT", "STABLE", "HOT", "ORPHAN"] as const;
/** A node with zero edges is always displayed as ORPHAN, regardless of its declared state — derived from graph structure the engine already computes, not something the caller needs to set by hand. */
export const ORPHAN_STATE: NodeState = 3;

/** Zoom level at which each label tier (0-3) starts earning screen space in `labelMode: "auto"`. Tier 0 is always drawn. */
export const TIER_ZOOM = [0, 1.0, 1.8, 3.0] as const;

export interface GraphNode<T = unknown> {
  id: string | number;
  categoryId: string;
  /** Display text — on-screen label, hover tooltip, inspector title. */
  label: string;
  state?: NodeState;
  /** Overrides the category's `size` for this node — for a size that is genuinely per-instance (a word count, a member count) without minting one category per node. */
  size?: number;
  /** Overrides the category's `sectorAngle` for this node, e.g. to jitter a category's arm into a loose wedge. */
  sectorAngle?: number;
  /** Overrides the category's `radiusTarget` for this node. */
  radiusTarget?: number;
  /** Opaque consumer payload. Never read internally; round-tripped through onSelect/getNode as `GraphNodeSnapshot.data`, the same reference. */
  data?: T;
}

export interface GraphEdge<T = unknown> {
  a: GraphNode["id"];
  b: GraphNode["id"];
  categoryId: string;
  /**
   * Marks an endpoint that is declared but has nothing behind it. The trace
   * frays out toward that end and lands on no pad, so the gap reads on the
   * link itself rather than only on the far glyph. (An endpoint id that
   * matches no node at all is a different case — see `onFatal`.)
   */
  absentEnd?: "a" | "b";
  data?: T;
}

export interface NodeCategory {
  /** Display name, e.g. "ATLAS". Not read internally — a consumer's own legend UI is the only reason this lives here rather than in a second parallel lookup. */
  label: string;
  shape: GlyphShapeIndex;
  /** Real hex — GPU-bound (Three.js `Color` parsing), can't be a CSS custom property. */
  color: string;
  /** Short class code shown in the hover tooltip, e.g. "ATL". */
  code: string;
  size: number;
  charge: number;
  mass: number;
  /** Label-visibility tier (0-3); see `TIER_ZOOM`. */
  tier: number;
  /** Radians. When set, every node of this category feels a gentle tangential pull toward this angle from the origin — an arm it belongs to. Needs `PhysicsConfig.sectorForce` above 0 to have any effect. */
  sectorAngle?: number;
  /** World units. When set, every node of this category feels a radial spring toward this distance from the origin — a ring it belongs to — in place of ordinary gravity. Needs `PhysicsConfig.radiusForce` above 0 to have any effect. */
  radiusTarget?: number;
}

/**
 * How an edge travels between its endpoints. Form is a channel in its own
 * right: giving each kind its own routing means brightness doesn't have to
 * carry the distinction, which is what lets every kind stay thin.
 *
 * - `straight` — a plain chord.
 * - `arc` — a shallow bow, by `curve`.
 * - `etched` — axis, 45°, axis, like a circuit trace. No right angle appears
 *   anywhere in the route, and the diagonal shrinks smoothly to nothing as the
 *   chord nears 45°, so a route never flips sides while a node moves.
 */
export type LinkRouting = "straight" | "arc" | "etched";

export interface LinkCategory {
  /** Display name, e.g. "LINK". Not read internally — same status as NodeCategory.label. */
  label: string;
  color: string;
  /** Half-width of the drawn trace, multiplied by `OpticsConfig.edgeWidth`. Constant: it never changes with hover or selection. */
  width: number;
  /** Rest distance, as a multiplier of `PhysicsConfig.linkDistance`. */
  dist: number;
  strength: number;
  /**
   * Brightness multiplier for this category, on top of `OpticsConfig.edgeOpacity`.
   * This is what separates a structural scaffold from a meaningful claim
   * while both stay the same width. Default 1.
   */
  gain?: number;
  /** Path the edge takes between its endpoints. Default `"straight"`. */
  routing?: LinkRouting;
  /** Bow for `routing: "arc"`; adjacent arcs alternate sides. Ignored by the other routings. Default 0.115. */
  curve?: number;
  /** Dash period in screen pixels, the same at any zoom. 0 or absent draws an unbroken trace. */
  dash?: number;
  /**
   * Whether the edge has a direction, from `a` to `b`. Directed edges end in a
   * filled bar at `a` and an open bracket at `b`; undirected edges get a
   * filled bar at both ends. Default true.
   */
  directed?: boolean;
  /**
   * How a screen reader reads this relation from the `a` end, e.g. "uses".
   * Defaults to the label: "<label> to". For an undirected category it is read
   * from both ends ("overlaps"), defaulting to "<label> with".
   */
  verb?: string;
  /** How it reads from the `b` end, e.g. "used by". Defaults to "<label> from". Ignored when `directed` is false. */
  inverseVerb?: string;
  /** Packet-flow speed along the edge; negative reverses direction. 0 disables the flow animation. */
  flow?: number;
  /** Jitter amount, for an unstable-looking edge (a contradiction, say): a travelling sine at 11 rad/s along the edge, scaled to zero under prefers-reduced-motion. */
  jit?: number;
}

export interface PhysicsConfig {
  repulsion: number;
  linkDistance: number;
  gravity: number;
  damping: number;
  cursorForce: number;
  /** Strength of each node's pull toward its `sectorAngle`, if it has one. Default 0, which turns the feature off. */
  sectorForce: number;
  /** Strength of each node's spring toward its `radiusTarget`, if it has one. Default 0, which turns the feature off and leaves those nodes on ordinary gravity. */
  radiusForce: number;
  /** Alpha target the solver simmers toward; 0 lets it settle to rest. */
  settle: number;
}

export interface OpticsConfig {
  /** Node glow intensity. */
  glow: number;
  /** Frame-persistence trail amount, 0-1. */
  trails: number;
  edgeOpacity: number;
  edgeWidth: number;
  flowSpeed: number;
  /** CRT scanline intensity. */
  scan: number;
  /** Chromatic aberration amount. */
  aberr: number;
  /** Barrel curvature; 0 disables the warp entirely. */
  curve: number;
  grain: number;
  bloom: number;
  glitch: number;
}

/** `T` is the type of the node's `data` payload — the same `T` as `GraphNode<T>`. */
export interface GraphNodeSnapshot<T = unknown> {
  id: GraphNode["id"];
  categoryId: string;
  label: string;
  /** Deterministic 4-hex-digit display id derived from the node's index. */
  hex: string;
  state: (typeof STATE_LABEL)[number];
  degree: number;
  /** Adjacent nodes, grouped by link category id — mirrors the original inspector's "adjacency" list. */
  groups: ReadonlyArray<{
    categoryId: string;
    rows: ReadonlyArray<{ id: GraphNode["id"]; label: string; categoryId: string; out: boolean }>;
  }>;
  /** The node's own `data`, handed back as the same reference rather than a copy; `undefined` when the node has none. */
  data?: T;
}

/**
 * Per-frame telemetry, sampled about twice a second. Everything here is about
 * the graph being drawn, not about the driver drawing it: `vertexAttribs` and
 * `webglVersion` used to be reported alongside, but they are constants of the
 * host's GL context, never change over the canvas's life, and were only ever
 * there as a leftover debugging aid from bringing the edge program up.
 */
export interface GraphStats {
  fps: number;
  nodes: number;
  edges: number;
  /** Nodes left on screen after `hiddenNodeCategories` and `isolateId` — the node-side counterpart of `drawnEdges`. A consumer can't derive it from its own filter state: isolation is resolved against adjacency only the engine holds. */
  drawnNodes: number;
  drawnEdges: number;
  frameMs: number;
  settled: boolean;
}

/**
 * Live per-frame geometry, for a consumer placing its own DOM over the canvas
 * in step with it. Every array is a buffer GraphCanvas reuses frame to frame:
 * read values inside the `onFrame` call and never keep the array itself.
 */
export interface FrameGeometry {
  /** Node ids in dense-index order; the arrays below are parallel to this. */
  ids: ReadonlyArray<GraphNode["id"]>;
  /** [x0, y0, x1, y1, ...], world space. */
  positions: Float32Array;
  /** 1 = hidden by isolation or a hidden category, 0 = visible. */
  hidden: Float32Array;
  /** World-space node radius. */
  radii: Float32Array;
  camera: { x: number; y: number; zoom: number };
  /** Canvas size and the CRT curve, for `project()`. */
  viewport: Viewport;
}

/** One of a node's connections, as `rankConnections` sees it. */
export interface Connection<T = unknown> {
  /** The node at the other end. */
  other: GraphNode<T>;
  edge: GraphEdge;
  categoryId: string;
  /** "out" when the node is the edge's `a`, "in" when it is `b`, "both" for an undirected category. */
  direction: "out" | "in" | "both";
  /** The category's weight: |gain| × strength. */
  strength: number;
}

/** What a keyboard or screen-reader step did, for `onNavigate`. */
export interface NavigateEvent<T = unknown> {
  action:
    | "enter"
    | "browse"
    | "filter"
    | "follow"
    | "toggleSelect"
    | "back"
    | "home"
    | "describe"
    | "help"
    | "escape"
    | "focusNode";
  /** The node the reader is on after the step, or null once they've left the graph. */
  node: GraphNodeSnapshot<T> | null;
  /** What was spoken, if anything. */
  announcement: string;
}

/** `T` is the node `data` type `getNode` returns; it matches the `T` of the `<GraphCanvas>` the ref is attached to. */
export interface GraphController<T = unknown> {
  /**
   * Frames every visible node, inside `fitInset`, and hands the camera back
   * to the auto-fit: while the layout is still settling, the frame keeps
   * tracking it until the reader pans or zooms.
   */
  fit(): void;
  /**
   * Centres the node in the free box (inside `fitInset`), zoomed in to at
   * least 2.6, and rides along with it while the layout is still settling.
   * Takes the camera off the auto-fit.
   */
  focus(id: GraphNode["id"]): void;
  /** Nudges the solver back above rest; `v` is the alpha floor (default matches the original UI's Reheat button). */
  reheat(v?: number): void;
  /** Re-scatters the nodes and runs the layout again from the start, without rebuilding the scene. With a seed (the default), the sequence of reseeds is reproducible too. */
  reseed(): void;
  getNode(id: GraphNode["id"]): GraphNodeSnapshot<T> | null;
  /**
   * Goes back to where the reader was before their last move — a followed
   * connection, a click on another node, or a cleared selection — restoring
   * the selection they had there (through `onSelect`). Shared with the
   * keyboard's Backspace, so a Back button in your own UI does the same thing.
   */
  back(): void;
  /** True when `back()` has somewhere to go. Read it after a selection change to enable or disable a Back button. */
  readonly canGoBack: boolean;
  /**
   * Puts the reader on a node — keyboard focus, not selection — and moves
   * focus into the graph so the arrow keys work from there. For a search box:
   * find a node, `focusNode(id)`, and the reader can browse its connections.
   * Pans the camera if the node is out of view. A step `back()` can undo.
   */
  focusNode(id: GraphNode["id"]): void;
}

/** `T` is the node `data` type, inferred from `nodes`, `ref` and `onSelect` together — an untyped `GraphController` ref widens it to `unknown`; `onSelect` and the controller's `getNode` hand it back typed. Defaults to `unknown`. */
export interface GraphCanvasProps<T = unknown> {
  nodes: readonly GraphNode<T>[];
  edges: readonly GraphEdge[];
  nodeCategories: Record<string, NodeCategory>;
  linkCategories: Record<string, LinkCategory>;
  physics?: Partial<PhysicsConfig>;
  optics?: Partial<OpticsConfig>;
  labelMode?: "auto" | "key" | "all" | "off";
  /** Category ids to hide. Replaces the original's imperative `nodeOn`/`refilter()` — this is a controlled prop instead. */
  hiddenNodeCategories?: readonly string[];
  hiddenLinkCategories?: readonly string[];
  /**
   * Link categories drawn only on edges that touch `selectedId`, and hidden
   * everywhere else, including when nothing is selected. For a dense computed
   * layer (one edge per node) that answers a question about the selected
   * node: shown graph-wide it paints a picture of the measure, not the graph.
   */
  selectionScopedLinkCategories?: readonly string[];
  /** When set, only this node and its immediate neighbours are shown. */
  isolateId?: GraphNode["id"] | null;
  /** Currently selected node, controlled — mirrors `isolateId`. The canvas notifies clicks via `onSelect`; the consumer owns the actual state (same pattern the original's own `useEffect(() => api.current.select(...), [selected])` already implied, just made explicit as a controlled prop instead of an imperative-only sync). */
  selectedId?: GraphNode["id"] | null;
  /** Pauses the physics solver (dragging still works) when false. Default true. */
  running?: boolean;
  /**
   * Seeds the layout's random scatter and the per-node/per-edge shader seeds.
   * Omitted, it is derived from the node ids, so the same graph draws the same
   * picture on every visit — readers learn where things are, and screenshots
   * are reproducible. A number pins a specific layout. `null` opts out:
   * `Math.random`, a different layout every mount.
   *
   * Positions also depend on the order of `nodes` (the initial spiral is laid
   * out by array index), so a consumer that wants a stable picture should
   * keep that order stable too. Changing `seed` rebuilds the scene.
   */
  seed?: number | null;
  /**
   * Edges the consumer's own floating chrome covers, in CSS pixels. The canvas
   * stays full-bleed, but every framing the camera chooses — the intro, `fit()`,
   * `focus()`, following a selection — lands in what's left. Omitted sides are
   * 0. Changing it re-frames, but only while the camera still belongs to the
   * auto-fit: once the reader has panned or zoomed by hand, their framing is
   * theirs, and a panel opening must not yank it back.
   */
  fitInset?: Partial<FitInset>;
  /**
   * When true (the default), selecting a node frames it and its direct
   * neighbours, riding along while the layout is still settling, and clearing
   * the selection frames the whole graph again. False leaves the camera alone
   * on selection, for a consumer that drives it with `focus()` and `fit()`.
   */
  followSelection?: boolean;
  /** Fires when the user clicks a node (or clicks empty space, with `null`) — update `selectedId` in response. */
  onSelect?: (node: GraphNodeSnapshot<T> | null) => void;
  onStats?: (stats: GraphStats) => void;
  /** Fires every rendered frame with live geometry. Read it synchronously: the arrays are reused, not reallocated. */
  onFrame?: (geometry: FrameGeometry) => void;
  /**
   * What to do with an edge whose endpoint id matches no node. `"error"` (the
   * default) fails the mount with a message naming the edge, through
   * `onFatal`. `"drop"` leaves the edge out, draws the rest, and reports what
   * it dropped through `onWarning` — for data that goes stale between a node
   * disappearing and its edges catching up. Duplicate ids and missing
   * categories always fail.
   */
  invalidEdges?: InvalidEdgePolicy;
  /** Recoverable problems, such as edges dropped under `invalidEdges: "drop"`. Without it they go to `console.warn`, so a drop is never silent. */
  onWarning?: (message: string, detail: { dropped: readonly DroppedEdge[] }) => void;
  /** Called once if WebGL setup throws (including an invalid graph: an edge to an unknown node id, a duplicate node id, or a category id missing from the maps) or the WebGL context is lost — the canvas renders nothing further after this. Context loss is terminal by design: three's renderer asks the browser to restore the context (it calls preventDefault on webglcontextlost), but the canvas does not resume when it is restored; remount it to recover. */
  onFatal?: (message: string) => void;
  /**
   * Accessible name for the graph. With keyboard navigation on (the default)
   * the root is a named `role="group"` the reader tabs into; with it off, a
   * named `role="img"`. Required in practice: a development build warns when
   * it's missing, because an unnamed group fails WCAG 4.1.2.
   */
  ariaLabel?: string;
  /**
   * Keyboard and screen-reader navigation (default true): one Tab stop into
   * the graph, then travel along connections — ← → to browse a node's
   * connections, ↑ ↓ for direction, Enter to follow, Backspace to go back,
   * Space to select, D to describe, ? for help, Escape to step out. Each step
   * is spoken through a live region. False leaves the canvas as a named image.
   */
  keyboardNavigation?: boolean;
  /** Show the one-line key hint while focus is inside the graph. Default true. */
  keyHints?: boolean;
  /** Your own wording for a node, spoken when the reader lands on it. Default: "<label>, <category>, <n> connections". */
  describeNode?: (node: GraphNode<T>, ctx: DescribeContext) => string;
  /** Your own order for a node's connections, most important first. Default: category weight, then category order, then label. */
  rankConnections?: (a: Connection<T>, b: Connection<T>) => number;
  /** Fires after every keyboard or screen-reader step, e.g. to keep a detail panel in step with focus. */
  onNavigate?: (event: NavigateEvent<T>) => void;
  className?: string;
  style?: CSSProperties;
}
