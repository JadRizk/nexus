import type { CSSProperties } from "react";
import type { FitInset, Viewport } from "./camera.js";
import type { DroppedEdge, InvalidEdgePolicy } from "./validate.js";
import type { DescribeContext } from "./describe.js";

/** Index into the six SDF node shapes the shader supports — same order @nexus-cyberdeck/react's `GLYPH_SHAPES` uses (circle, hexagon, diamond, ring, square, triangle). */
export type GlyphShapeIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** 0=DORMANT · 1=STABLE · 2=HOT (breathing/flicker in the node shader) · 3=ORPHAN (dimmed). */
export type NodeState = 0 | 1 | 2 | 3;
export const STATE_LABEL = ["DORMANT", "STABLE", "HOT", "ORPHAN"] as const;
/** Displayed state of any node with zero edges, whatever its declared state. */
export const ORPHAN_STATE: NodeState = 3;

/** Zoom level at which each label tier (0-3) starts earning screen space in `labelMode: "auto"`. Tier 0 is always drawn. */
export const TIER_ZOOM = [0, 1.0, 1.8, 3.0] as const;

export interface GraphNode<T = unknown> {
  id: string | number;
  categoryId: string;
  /** Display text — on-screen label, hover tooltip, inspector title. */
  label: string;
  state?: NodeState;
  /** Overrides the category's `size`. */
  size?: number;
  /** Overrides the category's `sectorAngle`. */
  sectorAngle?: number;
  /** Overrides the category's `radiusTarget`. */
  radiusTarget?: number;
  /** Opaque consumer payload. Never read internally; round-tripped through onSelect/getNode as `GraphNodeSnapshot.data`, the same reference. */
  data?: T;
}

export interface GraphEdge<T = unknown> {
  a: GraphNode["id"];
  b: GraphNode["id"];
  categoryId: string;
  /** Endpoint declared but empty; the trace frays out toward it. An id matching no node is `invalidEdges`' case. */
  absentEnd?: "a" | "b";
  data?: T;
}

export interface NodeCategory {
  /** Display name, e.g. "ATLAS"; screen-reader descriptions speak it too. */
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
  /** Radians from the origin; a tangential pull toward this angle. Needs `PhysicsConfig.sectorForce` > 0. */
  sectorAngle?: number;
  /** World units from the origin; a radial spring that replaces gravity. Needs `PhysicsConfig.radiusForce` > 0. */
  radiusTarget?: number;
}

/** `straight` chord, `arc` bowed by `curve`, or `etched` axis–45°–axis circuit trace. */
export type LinkRouting = "straight" | "arc" | "etched";

export interface LinkCategory {
  /** Display name, e.g. "LINK"; the default spoken `verb` is built from it. */
  label: string;
  color: string;
  /** Half-width of the trace, × `OpticsConfig.edgeWidth`. */
  width: number;
  /** Rest distance, as a multiplier of `PhysicsConfig.linkDistance`. */
  dist: number;
  strength: number;
  /** Brightness multiplier on top of `OpticsConfig.edgeOpacity`. Default 1. */
  gain?: number;
  /** Default `"straight"`. */
  routing?: LinkRouting;
  /** Bow for `routing: "arc"`. Default 0.115. */
  curve?: number;
  /** Dash period in screen pixels; 0 or absent is solid. */
  dash?: number;
  /** Direction runs `a` to `b`. Default true. */
  directed?: boolean;
  /** Spoken from the `a` end, e.g. "uses". Default "<label> to", or "<label> with" when undirected. */
  verb?: string;
  /** Spoken from the `b` end, e.g. "used by". Default "<label> from"; ignored when undirected. */
  inverseVerb?: string;
  /** Packet-flow speed; negative reverses, 0 disables. */
  flow?: number;
  /** Jitter amplitude of a travelling sine at 11 rad/s; zero under prefers-reduced-motion. */
  jit?: number;
}

export interface PhysicsConfig {
  repulsion: number;
  linkDistance: number;
  gravity: number;
  damping: number;
  cursorForce: number;
  /** Pull toward `sectorAngle`. Default 0 (off). */
  sectorForce: number;
  /** Spring toward `radiusTarget`. Default 0 (off). */
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
  /** Adjacent nodes, grouped by link category id. */
  groups: ReadonlyArray<{
    categoryId: string;
    rows: ReadonlyArray<{ id: GraphNode["id"]; label: string; categoryId: string; out: boolean }>;
  }>;
  /** The node's own `data`, handed back as the same reference rather than a copy; `undefined` when the node has none. */
  data?: T;
}

/** Per-frame telemetry, sampled about twice a second. */
export interface GraphStats {
  fps: number;
  nodes: number;
  edges: number;
  /** Nodes left after `hiddenNodeCategories` and `isolateId`. */
  drawnNodes: number;
  drawnEdges: number;
  frameMs: number;
  settled: boolean;
}

/** Reused and refilled in place every frame: read it inside `onFrame`, never keep it. */
export interface FrameGeometry {
  /** The arrays below are parallel to this. */
  ids: ReadonlyArray<GraphNode["id"]>;
  /** [x0, y0, x1, y1, ...], world space. */
  positions: Float32Array;
  /** 1 = hidden, 0 = visible. */
  hidden: Float32Array;
  /** World units. */
  radii: Float32Array;
  camera: { x: number; y: number; zoom: number };
  viewport: Viewport;
}

export type SelectSource = "pointer" | "keyboard" | "controller";

export interface Connection<T = unknown> {
  other: GraphNode<T>;
  edge: GraphEdge;
  categoryId: string;
  /** "out" from the edge's `a`, "in" from its `b`, "both" when undirected. */
  direction: "out" | "in" | "both";
  /** The category's weight: |gain| × strength. */
  strength: number;
}

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
  /** Null once the reader has left the graph. */
  node: GraphNodeSnapshot<T> | null;
  announcement: string;
}

/** `T` is the node `data` type `getNode` returns; it matches the `T` of the `<GraphCanvas>` the ref is attached to. */
export interface GraphController<T = unknown> {
  /** Frames every visible node inside `fitInset` and returns the camera to auto-fit. */
  fit(): void;
  /** Centres the node inside `fitInset` at zoom ≥ 2.6; takes the camera off auto-fit. */
  focus(id: GraphNode["id"]): void;
  /** Nudges the solver back above rest; `v` is the alpha floor. Default 1. */
  reheat(v?: number): void;
  /** Re-scatters and restarts the layout; reproducible when seeded. */
  reseed(): void;
  getNode(id: GraphNode["id"]): GraphNodeSnapshot<T> | null;
  /** Undoes the reader's last move and restores its selection via `onSelect`; same as Backspace. */
  back(): void;
  readonly canGoBack: boolean;
  /** Moves keyboard focus (not selection) onto the node; `back()` undoes it. */
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
  hiddenNodeCategories?: readonly string[];
  hiddenLinkCategories?: readonly string[];
  /** Drawn only on edges touching `selectedId`; hidden when nothing is selected. */
  selectionScopedLinkCategories?: readonly string[];
  /** When set, only this node and its immediate neighbours are shown. */
  isolateId?: GraphNode["id"] | null;
  /** Controlled selection; the canvas reports changes through `onSelect`. */
  selectedId?: GraphNode["id"] | null;
  /** Pauses the physics solver (dragging still works) when false. Default true. */
  running?: boolean;
  /** Layout and shader seed. Default derives from node ids; `null` uses `Math.random`. Layout also depends on `nodes` order. */
  seed?: number | null;
  /** CSS px covered by the consumer's chrome; camera framings land inside the rest. Omitted sides are 0. */
  fitInset?: Partial<FitInset>;
  /** Frame the selection and its neighbours, or the whole graph on clear. Default true. */
  followSelection?: boolean;
  /** `null` clears the selection; `"controller"` means `back()`. Update `selectedId` in response. */
  onSelect?: (node: GraphNodeSnapshot<T> | null, source: SelectSource) => void;
  onStats?: (stats: GraphStats) => void;
  /** Fires every frame; see `FrameGeometry` for its reuse rule. */
  onFrame?: (geometry: FrameGeometry) => void;
  /** Edges to an unknown node id: `"error"` (default) fails via `onFatal`; `"drop"` skips and reports via `onWarning`. */
  invalidEdges?: InvalidEdgePolicy;
  /** Recoverable problems, e.g. edges dropped by `invalidEdges: "drop"`. Default `console.warn`. */
  onWarning?: (message: string, detail: { dropped: readonly DroppedEdge[] }) => void;
  /** Called once on WebGL setup failure (an invalid graph included) or context loss; the canvas then renders nothing. Remount to recover. */
  onFatal?: (message: string) => void;
  /** Accessible name for the graph. Required in practice: an unnamed group fails WCAG 4.1.2, and dev builds warn. */
  ariaLabel?: string;
  /** Default true; false renders the canvas as a named `role="img"`. */
  keyboardNavigation?: boolean;
  /** Default true. */
  keyHints?: boolean;
  /** Default: "<label>, <category>, <n> connections". */
  describeNode?: (node: GraphNode<T>, ctx: DescribeContext) => string;
  /** Most important first. Default: category weight, then category order, then label. */
  rankConnections?: (a: Connection<T>, b: Connection<T>) => number;
  onNavigate?: (event: NavigateEvent<T>) => void;
  className?: string;
  style?: CSSProperties;
}
