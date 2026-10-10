/* ============================================================================
   CAMERA / CRT SCREEN MAPPING

   Moved from closures inside the prototype's boot() function into real,
   independently callable functions — same numerics, now parameterised
   instead of closing over `W`/`H`/`cfgRef.current.curve`/`nRadius`/`camZoom`.
   This is what makes them testable at all; nothing about the maths changed.

   The composite pass samples the scene through a barrel warp, so what is
   drawn at screen position p came from scene position warp(p). Any DOM
   overlay or hit-test that ignores this drifts by up to ~13px in the
   corners — and by exactly zero on the centre axes, because the shader
   cross-couples x with |y| and y with |x|. `project`/`unproject` mirror the
   render path exactly (ortho(zoom) -> barrel warp) so labels, picking and
   zoom-to-cursor can't drift apart from each other or from the shader.
   ========================================================================== */

/** screen -> scene */
export function crtFwd(nx: number, ny: number, c: number): readonly [number, number] {
  const ox = Math.abs(ny) / 6,
    oy = Math.abs(nx) / 5;
  return [nx + nx * ox * ox * c, ny + ny * oy * oy * c];
}

/** scene -> screen, by fixed-point iteration (crtFwd has no closed-form inverse) */
export function crtInv(nx: number, ny: number, c: number): readonly [number, number] {
  let px = nx,
    py = ny;
  for (let k = 0; k < 4; k++) {
    const ox = Math.abs(py) / 6,
      oy = Math.abs(px) / 5;
    const a = nx - px * ox * ox * c,
      b = ny - py * oy * oy * c;
    px = a;
    py = b;
  }
  return [px, py];
}

export interface Viewport {
  width: number;
  height: number;
  /** CRT barrel-curvature amount; 0 disables the warp entirely. */
  curve: number;
}

/** world -> CSS pixels. Accepts a reusable output tuple to avoid an allocation per call in the label-placement hot path. */
export function project(
  wx: number,
  wy: number,
  zoom: number,
  cx: number,
  cy: number,
  viewport: Viewport,
  out: [number, number] = [0, 0],
): [number, number] {
  const W = viewport.width,
    H = viewport.height,
    c = viewport.curve;
  let nx = ((wx - cx) * zoom) / (W / 2);
  let ny = (-(wy - cy) * zoom) / (H / 2);
  if (c > 0) {
    const p = crtInv(nx, ny, c);
    nx = p[0];
    ny = p[1];
  }
  out[0] = (nx * W) / 2 + W / 2;
  out[1] = (ny * H) / 2 + H / 2;
  return out;
}

/** CSS pixels -> world */
export function unproject(
  sx: number,
  sy: number,
  zoom: number,
  cx: number,
  cy: number,
  viewport: Viewport,
): { x: number; y: number } {
  const W = viewport.width,
    H = viewport.height,
    c = viewport.curve;
  let nx = (sx - W / 2) / (W / 2),
    ny = (sy - H / 2) / (H / 2);
  if (c > 0) {
    const p = crtFwd(nx, ny, c);
    nx = p[0];
    ny = p[1];
  }
  return { x: (nx * W) / 2 / zoom + cx, y: -((ny * H) / 2) / zoom + cy };
}

/**
 * Mirrors the node vertex shader's minimum-size clamp so the label gap stays
 * constant in pixels instead of collapsing into the node when zoomed out.
 * span = r*3.2 and the SDF glyph sits at R=0.285 of that -> 0.912*r.
 */
export function glyphRadiusPx(radius: number, zoom: number): number {
  return Math.max(radius * zoom, 2.2) * 0.912;
}

/** Screen-edge padding, in CSS pixels, that framing keeps the graph clear of (floating chrome). */
export interface FitInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSET: FitInset = { top: 0, right: 0, bottom: 0, left: 0 };

/** Camera zoom limits; every camera move clamps to these. */
export const ZOOM_MIN = 0.12;
export const ZOOM_MAX = 16;

const FIT_PADDING = 1.35;

/** World offset from canvas centre to free-box centre at `zoom`. Subtract x, add y (screen +y is down). */
export function insetOffset(inset: FitInset, zoom: number): readonly [number, number] {
  return [(inset.left - inset.right) / 2 / zoom, (inset.top - inset.bottom) / 2 / zoom];
}

/** Camera target framing (x0, y0)–(x1, y1) in the free area, which is clamped to ≥ 64px a side. */
export function fitBounds(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
  inset: FitInset = NO_INSET,
): { x: number; y: number; zoom: number } {
  const boxWidth = Math.max(1, x1 - x0),
    boxHeight = Math.max(1, y1 - y0);
  const freeWidth = Math.max(64, width - inset.left - inset.right);
  const freeHeight = Math.max(64, height - inset.top - inset.bottom);
  const zoom = Math.min(
    ZOOM_MAX,
    Math.max(
      ZOOM_MIN,
      Math.min(freeWidth / (boxWidth * FIT_PADDING), freeHeight / (boxHeight * FIT_PADDING)),
    ),
  );
  const [offsetX, offsetY] = insetOffset(inset, zoom);
  return { x: (x0 + x1) / 2 - offsetX, y: (y0 + y1) / 2 + offsetY, zoom };
}
