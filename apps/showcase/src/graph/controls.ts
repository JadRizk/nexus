import { DEFAULT_OPTICS, DEFAULT_PHYSICS } from "@nexus-cyberdeck/graph";
import type { GraphStats } from "@nexus-cyberdeck/graph";

export const DEFAULT_CONFIG = {
  repulsion: DEFAULT_PHYSICS.repulsion,
  linkDistance: DEFAULT_PHYSICS.linkDistance,
  cursorForce: DEFAULT_PHYSICS.cursorForce,
  settle: DEFAULT_PHYSICS.settle,
  flowSpeed: DEFAULT_OPTICS.flowSpeed,
  glow: DEFAULT_OPTICS.glow,
  trails: DEFAULT_OPTICS.trails,
  edgeOpacity: DEFAULT_OPTICS.edgeOpacity,
  edgeWidth: DEFAULT_OPTICS.edgeWidth,
  scan: DEFAULT_OPTICS.scan,
  aberr: DEFAULT_OPTICS.aberr,
  curve: DEFAULT_OPTICS.curve,
  grain: DEFAULT_OPTICS.grain,
  bloom: DEFAULT_OPTICS.bloom,
  glitch: DEFAULT_OPTICS.glitch,
};

export type DeckConfig = typeof DEFAULT_CONFIG;
export type SetDeckConfig = <K extends keyof DeckConfig>(key: K, value: DeckConfig[K]) => void;

export const DEFAULT_STATS: GraphStats = {
  fps: 0,
  nodes: 0,
  edges: 0,
  drawnNodes: 0,
  drawnEdges: 0,
  frameMs: 0,
  settled: false,
};

/** Widths of the panels floating over the canvas, and the gap around each, in px. */
export const CONSOLE_WIDTH = 248;
export const DRAWER_WIDTH = 296;
export const PANEL_GAP = 12;

export interface SliderSpec {
  key: keyof DeckConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
}

const fixed = (digits: number) => (value: number) => value.toFixed(digits);

export const OPTICS_SLIDERS = [
  { key: "scan", label: "scanlines", min: 0, max: 1, step: 0.02, format: fixed(2) },
  { key: "aberr", label: "aberration", min: 0, max: 3, step: 0.05, format: fixed(2) },
  { key: "curve", label: "curvature", min: 0, max: 1.6, step: 0.02, format: fixed(2) },
  { key: "bloom", label: "bloom", min: 0, max: 2.5, step: 0.05, format: fixed(2) },
  { key: "grain", label: "grain", min: 0, max: 1.5, step: 0.02, format: fixed(2) },
  { key: "glitch", label: "glitch", min: 0, max: 2, step: 0.05, format: fixed(2) },
  { key: "trails", label: "persistence", min: 0, max: 0.92, step: 0.01, format: fixed(2) },
  { key: "flowSpeed", label: "packet rate", min: 0, max: 1, step: 0.01, format: fixed(2) },
] as const satisfies readonly SliderSpec[];

export const SOLVER_SLIDERS = [
  { key: "edgeWidth", label: "link width", min: 0.4, max: 3, step: 0.1, format: fixed(1) },
  { key: "edgeOpacity", label: "link gain", min: 0, max: 2.5, step: 0.05, format: fixed(2) },
  { key: "glow", label: "node glow", min: 0, max: 2.5, step: 0.05, format: fixed(2) },
  { key: "repulsion", label: "repulsion", min: 100, max: 2200, step: 20 },
  { key: "linkDistance", label: "link length", min: 20, max: 200, step: 2 },
  { key: "cursorForce", label: "cursor field", min: -1, max: 1, step: 0.05, format: fixed(2) },
  {
    key: "settle",
    label: "drift",
    min: 0,
    max: 0.06,
    step: 0.002,
    format: (value) => (value === 0 ? "LOCK" : value.toFixed(3)),
  },
] as const satisfies readonly SliderSpec[];
