import { glyphRadiusPx, project } from "./camera.js";
import type { Viewport } from "./camera.js";
import { TIER_ZOOM } from "./types.js";

const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';

export type LabelMode = "off" | "all" | "key" | "auto";

/** Make the hovered and selected labels always win the collision test. */
const SCORE_HOVER_OVERRIDE = 1e4;
const SCORE_SELECT_OVERRIDE = 2e4;

/** Unpadded pixel width of `text` in `font`; the placer owns caching and padding. */
export type MeasureText = (text: string, font: string) => number;

export interface LabelView {
  count: number;
  /** Interleaved x,y, world units. */
  pos: Float32Array;
  /** 1 = hidden, 0 = visible. */
  hidden: Float32Array;
  /** World units. */
  radii: Float32Array;
  /** ≥ 0 inside the active neighbourhood, -1 outside. */
  depth: Float32Array;
  /** 0 = landmark .. 3. */
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
  /** Clears and refills `out` with this frame's placements; returns the count placed. */
  place(view: LabelView, out: Map<number, PlacedLabel>): number;
}

export function createLabelPlacer(options: LabelPlacerOptions): LabelPlacer {
  const { poolSize, labelHeight, measure } = options;

  let capacity = -1;
  let widthCache = new Float32Array(0);
  let candidateScore = new Float64Array(0);
  let candidateOrder = new Int32Array(0);
  // Float64 boxes: float32 rounding can flip a strict-< collision edge.
  const boxX = new Float64Array(poolSize),
    boxY = new Float64Array(poolSize),
    boxW = new Float64Array(poolSize);

  const PROJECTED: [number, number] = [0, 0];

  function ensureCapacity(nodeCount: number) {
    if (nodeCount === capacity) return;
    capacity = nodeCount;
    widthCache = new Float32Array(nodeCount).fill(-1);
    candidateScore = new Float64Array(nodeCount);
    candidateOrder = new Int32Array(nodeCount);
  }

  function labelWidth(i: number, text: string, landmark: boolean): number {
    if (widthCache[i] < 0) {
      const font = landmark ? `700 10.5px ${MONO}` : `500 9px ${MONO}`;
      widthCache[i] = measure(text, font) + text.length * (landmark ? 1.47 : 0.72) + 7;
    }
    return widthCache[i];
  }

  function place(view: LabelView, out: Map<number, PlacedLabel>): number {
    const { count, pos: positions, hidden, radii, depth, tier, zoom, cx, cy, viewport } = view;
    const { mode, selIdx: selectedIndex, hoverIdx: hoverIndex } = view;
    ensureCapacity(count);

    out.clear();
    if (mode === "off") return 0;

    const width = viewport.width,
      height = viewport.height;
    const worldPerPixel = 1 / zoom;
    const halfWidth = (width / 2) * worldPerPixel * 1.15,
      halfHeight = (height / 2) * worldPerPixel * 1.15;
    const focused = selectedIndex >= 0 || hoverIndex >= 0;

    let candidateCount = 0;
    for (let i = 0; i < count; i++) {
      if (hidden[i] !== 0) continue;
      const x = positions[i * 2],
        y = positions[i * 2 + 1];
      if (Math.abs(x - cx) > halfWidth || Math.abs(y - cy) > halfHeight) continue;

      const nodeTier = tier[i];
      const isTarget = i === selectedIndex || i === hoverIndex;
      const inFlow = depth[i] >= 0;
      const landmark = nodeTier === 0;

      let earns: boolean;
      if (mode === "all") earns = true;
      else if (mode === "key") earns = landmark || isTarget || depth[i] === 1;
      else earns = isTarget || inFlow || zoom >= TIER_ZOOM[nodeTier];
      if (!earns) continue;

      // Landmarks stay while focused so the reader keeps their bearings.
      if (focused && !inFlow && !isTarget && !landmark) continue;

      let score = radii[i] + (3 - nodeTier) * 9;
      if (inFlow) score += depth[i] === 1 ? 70 : 30;
      if (i === hoverIndex) score += SCORE_HOVER_OVERRIDE;
      if (i === selectedIndex) score += SCORE_SELECT_OVERRIDE;
      candidateScore[i] = score;
      candidateOrder[candidateCount++] = i;
    }
    // Stable sort: equal scores keep ascending node index, which a test pins.
    candidateOrder
      .subarray(0, candidateCount)
      .sort((a, b) => candidateScore[b] - candidateScore[a]);

    let boxCount = 0;
    for (let k = 0; k < candidateCount && out.size < poolSize; k++) {
      const i = candidateOrder[k];
      const screen = project(
        positions[i * 2],
        positions[i * 2 + 1],
        zoom,
        cx,
        cy,
        viewport,
        PROJECTED,
      );
      const sx = screen[0],
        sy = screen[1];
      if (sx < -60 || sx > width + 60 || sy < -24 || sy > height + 24) continue;
      const landmark = tier[i] === 0;
      const boxLeft = sx + glyphRadiusPx(radii[i], zoom) + 8;
      const boxTop = sy - labelHeight * 0.5;
      const boxWidth = labelWidth(i, view.label(i), landmark);
      let hit = false;
      for (let q = 0; q < boxCount; q++) {
        const placedLeft = boxX[q],
          placedTop = boxY[q],
          placedWidth = boxW[q];
        if (
          boxLeft < placedLeft + placedWidth &&
          boxLeft + boxWidth > placedLeft &&
          boxTop < placedTop + labelHeight &&
          boxTop + labelHeight > placedTop
        ) {
          hit = true;
          break;
        }
      }
      if (hit) continue;
      const opacity =
        i === selectedIndex || i === hoverIndex
          ? 1
          : depth[i] >= 0
            ? 0.92
            : focused
              ? 0.28
              : landmark
                ? 0.82
                : 0.52;
      boxX[boxCount] = boxLeft;
      boxY[boxCount] = boxTop;
      boxW[boxCount] = boxWidth;
      boxCount++;
      out.set(i, [boxLeft, boxTop, opacity]);
    }
    return out.size;
  }

  return { place };
}
