import type { CSSProperties } from "react";

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
  /** Opaque consumer payload. Never read internally; round-tripped through onSelect/getNode. */
  data?: T;
}

export interface GraphEdge<T = unknown> {
  a: GraphNode["id"];
  b: GraphNode["id"];
  categoryId: string;
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
}

export interface LinkCategory {
  /** Display name, e.g. "LINK". Not read internally — same status as NodeCategory.label. */
  label: string;
  color: string;
  width: number;
  /** Rest distance, as a multiplier of `PhysicsConfig.linkDistance`. */
  dist: number;
  strength: number;
  dash?: number;
  arrow?: boolean;
  /** Packet-flow speed/direction along the edge; negative reverses direction. 0 disables the flow animation. */
  flow?: number;
  curve?: number;
  /** Jitter amount for the "contradicts"-style unstable-edge look. */
  jit?: number;
}

export interface PhysicsConfig {
  repulsion: number;
  linkDistance: number;
  gravity: number;
  damping: number;
  cursorForce: number;
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

export interface GraphNodeSnapshot {
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
  drawnEdges: number;
  frameMs: number;
  settled: boolean;
}

export interface GraphController {
  /** Frames the camera to fit every currently-visible node. */
  fit(): void;
  focus(id: GraphNode["id"]): void;
  /** Nudges the solver back above rest; `v` is the alpha floor (default matches the original UI's Reheat button). */
  reheat(v?: number): void;
  getNode(id: GraphNode["id"]): GraphNodeSnapshot | null;
}

export interface GraphCanvasProps {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  nodeCategories: Record<string, NodeCategory>;
  linkCategories: Record<string, LinkCategory>;
  physics?: Partial<PhysicsConfig>;
  optics?: Partial<OpticsConfig>;
  labelMode?: "auto" | "key" | "all" | "off";
  /** Category ids to hide. Replaces the original's imperative `nodeOn`/`refilter()` — this is a controlled prop instead. */
  hiddenNodeCategories?: readonly string[];
  hiddenLinkCategories?: readonly string[];
  /** When set, only this node and its immediate neighbours are shown. */
  isolateId?: GraphNode["id"] | null;
  /** Currently selected node, controlled — mirrors `isolateId`. The canvas notifies clicks via `onSelect`; the consumer owns the actual state (same pattern the original's own `useEffect(() => api.current.select(...), [selected])` already implied, just made explicit as a controlled prop instead of an imperative-only sync). */
  selectedId?: GraphNode["id"] | null;
  /** Pauses the physics solver (dragging still works) when false. Default true. */
  running?: boolean;
  /** Fires when the user clicks a node (or clicks empty space, with `null`) — update `selectedId` in response. */
  onSelect?: (node: GraphNodeSnapshot | null) => void;
  onStats?: (stats: GraphStats) => void;
  /** Called once if WebGL setup throws (including an invalid graph: an edge to an unknown node id, a duplicate node id, or a category id missing from the maps) or the WebGL context is lost — the canvas renders nothing further after this. */
  onFatal?: (message: string) => void;
  /** Accessible name for the canvas, exposed via `role="img"`. The label pool and tooltip are `aria-hidden` — this is the one name assistive tech gets for the whole graph. */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}
