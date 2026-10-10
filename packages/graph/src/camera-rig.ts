/* ============================================================================
   CAMERA RIG

   Who owns the camera, and where it is heading. Pure: GraphCanvas copies
   `live` into the three.js camera each frame. Owners, in order of who wins:

   - The reader. A pan or wheel zoom (`takeOver`) holds the camera until a
     fit or a reseed.
   - A focus. Parks on a node and rides along with it until the layout
     settles or the reader takes over.
   - The auto-fit. Tracks the settling layout's bounds; the intro sweep is
     this running from the first frame.

   Dragging a node owns nothing: ending the auto-fit on it would freeze the
   intro while the rest of the layout keeps moving.
   ========================================================================== */

import { fitBounds, insetOffset, ZOOM_MAX } from "./camera.js";
import type { FitInset } from "./camera.js";

/** World-space box: [x0, y0, x1, y1]. */
export type Bounds = readonly [number, number, number, number];

export interface CameraPose {
  x: number;
  y: number;
  zoom: number;
}

export interface CameraRigDeps {
  /** Bounds of the visible nodes among `indices` (all nodes when omitted), or null if none are visible. */
  bounds(indices?: readonly number[]): Bounds | null;
  position(index: number): readonly [number, number];
  /** Canvas size in CSS pixels. */
  viewport(): { width: number; height: number };
  inset(): FitInset;
}

export interface CameraTick {
  /** Seconds since the last frame. */
  dt: number;
  stepped: boolean;
  settled: boolean;
  /** prefers-reduced-motion: every move lands at once. */
  reduced: boolean;
}

/** The intro starts this many times tighter than the fit and eases out to it. */
export const INTRO_ZOOM_MULTIPLIER = 6;
export const FOCUS_ZOOM = 2.6;
/** How far inside the free box, in CSS px, a node must sit for `reveal()` to leave the camera alone. */
export const REVEAL_MARGIN = 48;

export interface CameraRig {
  /** Where the camera is heading. Gestures write here. */
  readonly target: CameraPose;
  /** Where the camera is this frame, eased toward `target`. */
  readonly live: CameraPose;
  readonly autoFit: boolean;
  readonly userOwned: boolean;
  /** Index of the node being followed, or -1. */
  readonly follow: number;

  intro(reduced: boolean): void;
  fit(): void;
  /** The free box changed shape; re-fits only while the auto-fit owns the camera. */
  reframe(): void;
  /** Centre a node in the free box at ≥ FOCUS_ZOOM and ride along with it. */
  focus(index: number): void;
  /** Pan, at the current zoom, only if the node sits outside the free box minus REVEAL_MARGIN (WCAG 2.4.11). */
  reveal(index: number): void;
  frameAround(index: number, neighbours: readonly number[]): void;
  release(): void;
  reseed(reduced: boolean): void;
  takeOver(): void;
  /** World-space pan applied to `live` and `target` together, so a drag tracks 1:1. */
  panBy(dx: number, dy: number): void;
  tick(frame: CameraTick): void;
}

export function createCameraRig(deps: CameraRigDeps): CameraRig {
  const target: CameraPose = { x: 0, y: 0, zoom: 1 };
  const live: CameraPose = { x: 0, y: 0, zoom: 1 };
  let autoFit = true,
    userOwned = false,
    follow = -1,
    followDX = 0,
    followDY = 0;
  // Low-passed bounds for the auto-fit, so the solver's overshoot doesn't pump the zoom.
  let smoothX0 = 0,
    smoothY0 = 0,
    smoothX1 = 0,
    smoothY1 = 0;

  function frameBox(box: Bounds) {
    const { width, height } = deps.viewport();
    const fit = fitBounds(box[0], box[1], box[2], box[3], width, height, deps.inset());
    target.x = fit.x;
    target.y = fit.y;
    target.zoom = fit.zoom;
  }
  function fitToView() {
    // tick() follows after this every frame; left set, it would pull the camera back to the node.
    follow = -1;
    const box = deps.bounds();
    if (!box) return;
    frameBox(box);
    [smoothX0, smoothY0, smoothX1, smoothY1] = box;
  }
  function sweepZoom() {
    return Math.min(ZOOM_MAX, target.zoom * INTRO_ZOOM_MULTIPLIER);
  }
  function rideAlong(index: number) {
    const [x, y] = deps.position(index);
    follow = index;
    followDX = target.x - x;
    followDY = target.y - y;
  }

  return {
    target,
    live,
    get autoFit() {
      return autoFit;
    },
    get userOwned() {
      return userOwned;
    },
    get follow() {
      return follow;
    },
    intro(reduced) {
      fitToView();
      live.x = target.x;
      live.y = target.y;
      live.zoom = reduced ? target.zoom : sweepZoom();
    },
    fit() {
      fitToView();
      autoFit = true;
      userOwned = false;
    },
    reframe() {
      if (autoFit) fitToView();
    },
    focus(index) {
      autoFit = false;
      target.zoom = Math.max(target.zoom, FOCUS_ZOOM);
      const [x, y] = deps.position(index);
      const [offsetX, offsetY] = insetOffset(deps.inset(), target.zoom);
      target.x = x - offsetX;
      target.y = y + offsetY;
      rideAlong(index);
    },
    reveal(index) {
      const [x, y] = deps.position(index);
      const { width, height } = deps.viewport();
      const inset = deps.inset();
      const screenX = width / 2 + (x - target.x) * target.zoom;
      const screenY = height / 2 - (y - target.y) * target.zoom;
      const isInside =
        screenX >= inset.left + REVEAL_MARGIN &&
        screenX <= width - inset.right - REVEAL_MARGIN &&
        screenY >= inset.top + REVEAL_MARGIN &&
        screenY <= height - inset.bottom - REVEAL_MARGIN;
      if (isInside) return;
      autoFit = false;
      const [offsetX, offsetY] = insetOffset(inset, target.zoom);
      target.x = x - offsetX;
      target.y = y + offsetY;
      rideAlong(index);
    },
    frameAround(index, neighbours) {
      const box = deps.bounds([index, ...neighbours]);
      if (!box) return fitToView();
      autoFit = false;
      frameBox(box);
      rideAlong(index);
    },
    release() {
      fitToView();
      autoFit = !userOwned;
    },
    reseed(reduced) {
      const shouldSweep = !userOwned && !reduced;
      autoFit = true;
      userOwned = false;
      fitToView();
      if (shouldSweep) live.zoom = sweepZoom();
    },
    takeOver() {
      autoFit = false;
      userOwned = true;
      follow = -1;
    },
    panBy(dx, dy) {
      live.x += dx;
      live.y += dy;
      target.x = live.x;
      target.y = live.y;
    },
    tick({ dt, stepped, settled, reduced }) {
      if (follow >= 0) {
        if (settled) follow = -1;
        else if (stepped) {
          const [x, y] = deps.position(follow);
          target.x = x + followDX;
          target.y = y + followDY;
        }
      }
      if (autoFit && stepped && !settled) {
        const box = deps.bounds();
        if (box) {
          const smoothing = 1 - Math.pow(0.25, dt);
          smoothX0 += (box[0] - smoothX0) * smoothing;
          smoothY0 += (box[1] - smoothY0) * smoothing;
          smoothX1 += (box[2] - smoothX1) * smoothing;
          smoothY1 += (box[3] - smoothY1) * smoothing;
          frameBox([smoothX0, smoothY0, smoothX1, smoothY1]);
        }
      }
      if (reduced) {
        live.x = target.x;
        live.y = target.y;
        live.zoom = target.zoom;
        return;
      }
      const easing = 1 - Math.pow(0.0045, dt);
      live.x += (target.x - live.x) * easing;
      live.y += (target.y - live.y) * easing;
      live.zoom += (target.zoom - live.zoom) * easing;
    },
  };
}
