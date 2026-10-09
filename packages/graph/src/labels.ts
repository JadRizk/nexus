/* ============================================================================
   LABELS — placement (not rendering)

   Moved out of GraphCanvas.tsx's `frame()` label block, plus the `labelWidth`
   measurement cache. Decides which nodes earn a label this frame, at what
   screen position, and at what opacity — a placement snapshot, nothing more.
   The DOM pool (which of the reusable elements shows which label, so labels
   don't flicker between DOM nodes as the placement changes) stays in
   GraphCanvas: it mutates the DOM and nothing else, and consumes this
   module's output rather than being part of the decision.

   Anchored via project(), so a label sits at its node's *drawn* position and
   its gap from the node is a constant number of pixels at any zoom.
   ========================================================================== */

import { glyphRadiusPx, project } from "./camera.js";
import type { Viewport } from "./camera.js";
import { TIER_ZOOM } from "./types.js";

const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

export type LabelMode = "off" | "all" | "key" | "auto";

/** Score bumps that make the hovered/selected node's label always win the collision test, regardless of its earned score. */
const SCORE_HOVER_OVERRIDE = 1e4;
const SCORE_SELECT_OVERRIDE = 2e4;

/** Raw text measurement, injected: canvas `measureText` in production, a fixed-width stub in tests. Returns the unpadded pixel width of `text` set in `font` — the placer owns the cache and the padding math. */
export type MeasureText = (text: string, font: string) => number;

export interface LabelView {
  count: number;
  /** length count*2, interleaved x,y. */
  pos: Float32Array;
  /** length count. 1 = hidden, 0 = visible. */
  hidden: Float32Array;
  /** length count, per-node draw radius (world units). */
  radii: Float32Array;
  /** length count. computeNeighbourhood's per-node depth: >= 0 means "in the active neighbourhood", -1 means not. */
  depth: Float32Array;
  /** length count, per-node category tier (0 = landmark .. 3). */
  tier: Float32Array;
  label: (i: number) => string;
  zoom: number;
  /** Camera position, world units. */
  cx: number;
  cy: number;
  viewport: Viewport;
  mode: LabelMode;
  selIdx: number;
  hoverIdx: number;
}

/** [screenX, screenY, opacity]. */
export type PlacedLabel = [number, number, number];

export interface LabelPlacerOptions {
  poolSize: number;
  /** Collision-box height, screen px. Not the rendered font size. */
  labelHeight: number;
  measure: MeasureText;
}

export interface LabelPlacer {
  /** Clears `out`, decides this frame's placements, and writes them in. Returns the count placed. */
  place(view: LabelView, out: Map<number, PlacedLabel>): number;
}

export function createLabelPlacer(opts: LabelPlacerOptions): LabelPlacer {
  const { poolSize, labelHeight: LAB_H, measure } = opts;

  /* Placement runs every frame over every visible node, so its working set is
     allocated once and refilled in place rather than rebuilt per frame — at
     60fps on a few hundred nodes, fresh `[score, index]` and `[x, y, w]`
     tuples would be tens of thousands of short-lived arrays a second, all of
     it garbage the collector has to walk during the animation it is trying
     not to interrupt. The node-sized buffers are reallocated only when the
     node count changes, never per frame.

     The boxes are Float64Array, not Float32Array: they hold screen
     coordinates compared with strict `<`/`>` at collision boundaries, and
     single-precision rounding is enough to flip a boundary case. */
  let cap = -1;
  let wCache = new Float32Array(0);
  let candScore = new Float64Array(0);
  let candOrder = new Int32Array(0);
  const boxX = new Float64Array(poolSize),
    boxY = new Float64Array(poolSize),
    boxW = new Float64Array(poolSize);

  // Reused output tuple for project() — see camera.ts on why it takes one.
  const PROJECTED: [number, number] = [0, 0];

  function ensureCapacity(n: number) {
    if (n === cap) return;
    cap = n;
    wCache = new Float32Array(n).fill(-1);
    candScore = new Float64Array(n);
    candOrder = new Int32Array(n);
  }

  // Measure once per node instead of guessing from character count — the
  // collision test is only as good as the box it is given.
  function labelWidth(i: number, text: string, landmark: boolean): number {
    if (wCache[i]! < 0) {
      const font = landmark ? `700 10.5px ${MONO}` : `500 9px ${MONO}`;
      wCache[i] = measure(text, font) + text.length * (landmark ? 1.47 : 0.72) + 7;
    }
    return wCache[i]!;
  }

  function place(view: LabelView, out: Map<number, PlacedLabel>): number {
    const { count: n, pos, hidden, radii, depth, tier, zoom, cx, cy, viewport } = view;
    const { mode, selIdx, hoverIdx } = view;
    ensureCapacity(n);

    out.clear();
    if (mode === "off") return 0;

    const W = viewport.width,
      H = viewport.height;
    const px = 1 / zoom;
    const hw = (W / 2) * px * 1.15,
      hh = (H / 2) * px * 1.15;
    const focused = selIdx >= 0 || hoverIdx >= 0;

    let candN = 0;
    for (let i = 0; i < n; i++) {
      if (hidden[i] !== 0) continue;
      const x = pos[i * 2]!,
        y = pos[i * 2 + 1]!;
      if (Math.abs(x - cx) > hw || Math.abs(y - cy) > hh) continue;

      const t = tier[i]!;
      const isTarget = i === selIdx || i === hoverIdx;
      const inFlow = depth[i]! >= 0; // inside the active neighbourhood
      const landmark = t === 0;

      // Three ways to earn a name: you're the target, you're in the active
      // flow, or your tier has come into range at this zoom.
      let earns: boolean;
      if (mode === "all") earns = true;
      else if (mode === "key") earns = landmark || isTarget || depth[i] === 1;
      else earns = isTarget || inFlow || zoom >= TIER_ZOOM[t]!;
      if (!earns) continue;

      // While something is focused, everything outside the flow steps back
      // — except landmarks, which you need to keep your bearings.
      if (focused && !inFlow && !isTarget && !landmark) continue;

      let sc = radii[i]! + (3 - t) * 9;
      if (inFlow) sc += depth[i] === 1 ? 70 : 30;
      if (i === hoverIdx) sc += SCORE_HOVER_OVERRIDE;
      if (i === selIdx) sc += SCORE_SELECT_OVERRIDE;
      candScore[i] = sc;
      candOrder[candN++] = i;
    }
    // Sorts the live prefix in place — a subarray is a view on the same
    // buffer, not a copy. Typed-array sort is stable, so equal scores keep
    // ascending node index; that order is load-bearing and pinned by a test.
    candOrder.subarray(0, candN).sort((a, b) => candScore[b]! - candScore[a]!);

    let boxN = 0;
    for (let k = 0; k < candN && out.size < poolSize; k++) {
      const i = candOrder[k]!;
      const sp = project(pos[i * 2]!, pos[i * 2 + 1]!, zoom, cx, cy, viewport, PROJECTED);
      const sx = sp[0],
        sy = sp[1];
      if (sx < -60 || sx > W + 60 || sy < -24 || sy > H + 24) continue;
      const landmark = tier[i]! === 0;
      const bx = sx + glyphRadiusPx(radii[i]!, zoom) + 8;
      const by = sy - LAB_H * 0.5;
      const bw = labelWidth(i, view.label(i), landmark);
      let hit = false;
      for (let q = 0; q < boxN; q++) {
        const qx = boxX[q]!,
          qy = boxY[q]!,
          qw = boxW[q]!;
        if (bx < qx + qw && bx + bw > qx && by < qy + LAB_H && by + LAB_H > qy) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
      const op =
        i === selIdx || i === hoverIdx
          ? 1
          : depth[i]! >= 0
            ? 0.92
            : focused
              ? 0.28 // landmark, holding position
              : landmark
                ? 0.82
                : 0.52;
      boxX[boxN] = bx;
      boxY[boxN] = by;
      boxW[boxN] = bw;
      boxN++;
      out.set(i, [bx, by, op]);
    }
    return out.size;
  }

  return { place };
}
