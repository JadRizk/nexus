/* ============================================================================
   CAMERA RIG

   Who owns the camera, and where it is heading. Pure: no DOM, no WebGL —
   GraphCanvas reads `live` into the three.js camera each frame and feeds
   pointer gestures in, so every rule below is unit-testable.

   Three owners, in order of who wins:

   - The reader. A pan or a wheel zoom (`takeOver`) ends everything else; the
     framing is theirs until they ask for a fit, or a reseed scrambles the
     layout out from under them.
   - A focus. `focus()` or a followed selection parks the camera on a node
     and rides along with it, at a fixed offset, while the layout is still
     moving — released once the layout settles or the reader takes over.
   - The auto-fit. From mount, after an explicit fit, and after a reseed, the
     target tracks the settling layout's bounds through a low-pass, so the
     intro "sweep" is just this running from the first frame.

   Dragging a node owns nothing: it moves one node, not the view, and ending
   the auto-fit on it would freeze the intro's tracking while the rest of the
   unsettled layout keeps rearranging.
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
  /** Current world position of node `i`. */
  position(i: number): readonly [number, number];
  /** Canvas size in CSS pixels. */
  viewport(): { width: number; height: number };
  /** Edges covered by the consumer's floating chrome. */
  inset(): FitInset;
}

export interface CameraTick {
  /** Seconds since the last frame. */
  dt: number;
  /** True when physics stepped this frame, so positions may have moved. */
  stepped: boolean;
  /** True when the solver has come to rest. */
  settled: boolean;
  /** prefers-reduced-motion: every move lands at once instead of easing. */
  reduced: boolean;
}

/**
 * The intro sweep: the live zoom starts this many times tighter than the
 * real fit, and the ordinary easing pulls it back out. The target is the
 * measured fit from the first frame, so the sweep never swaps targets
 * mid-flight (which read as a twitch).
 */
export const INTRO_ZOOM_MULTIPLIER = 6;
/** The least zoom `focus()` lands on. */
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

  /** First framing at mount: fit the layout, then sweep in unless `reduced`. */
  intro(reduced: boolean): void;
  /** An explicit fit request: frame everything and hand the camera back to the auto-fit. */
  fit(): void;
  /** The free box changed shape. Re-fits, but only while the auto-fit owns the camera. */
  reframe(): void;
  /** Centre a node in the free box, zoomed in to at least FOCUS_ZOOM, and ride along with it. */
  focus(i: number): void;
  /**
   * Keep a node in view for keyboard focus. If it already sits inside the free
   * box (with a margin), nothing moves; otherwise the camera pans, at the
   * current zoom, to put it in the middle of the free box, and rides along
   * while the layout settles. Panning without dragging (WCAG 2.5.7), and focus
   * never parked off-screen (2.4.11).
   */
  reveal(i: number): void;
  /** Frame a node and the given neighbours, and ride along with the node. */
  frameAround(i: number, neighbours: readonly number[]): void;
  /** The followed selection was cleared: frame everything, and resume tracking unless the reader has taken over. */
  release(): void;
  /** The layout was re-scattered. Sweeps in again only if the reader never took the camera. */
  reseed(reduced: boolean): void;
  /** The reader panned or zoomed by hand. */
  takeOver(): void;
  /** Pan by a world-space delta, applied to the live camera and the target together so a drag tracks 1:1. */
  panBy(dx: number, dy: number): void;
  /** Advance one frame: follow, auto-fit, then ease `live` toward `target`. */
  tick(t: CameraTick): void;
}

export function createCameraRig(deps: CameraRigDeps): CameraRig {
  const target: CameraPose = { x: 0, y: 0, zoom: 1 };
  const live: CameraPose = { x: 0, y: 0, zoom: 1 };
  let autoFit = true,
    userOwned = false,
    follow = -1,
    followDX = 0,
    followDY = 0;
  // The auto-fit's own view of the bounds, eased more slowly than the camera.
  // The solver doesn't expand monotonically — a node easing into its ring can
  // overshoot and spring back — and feeding raw bounds to the camera made it
  // zoom in and out along with them. This low-pass absorbs that, while still
  // tracking a real, sustained expansion within about a second.
  let fx0 = 0,
    fy0 = 0,
    fx1 = 0,
    fy1 = 0;

  function frameBox(b: Bounds) {
    const { width, height } = deps.viewport();
    const f = fitBounds(b[0], b[1], b[2], b[3], width, height, deps.inset());
    target.x = f.x;
    target.y = f.y;
    target.zoom = f.zoom;
  }
  /** Frames the whole visible graph and snaps the low-pass to it. */
  function fitToView() {
    // Framing everything and riding one node are different targets, and the
    // follow step in tick() runs after this every frame. Left set, it would
    // pull the camera straight back to the node.
    follow = -1;
    const b = deps.bounds();
    if (!b) return;
    frameBox(b);
    [fx0, fy0, fx1, fy1] = b;
  }
  /** Where the intro sweep starts: tighter than the fit, but never past ZOOM_MAX. */
  function sweepZoom() {
    return Math.min(ZOOM_MAX, target.zoom * INTRO_ZOOM_MULTIPLIER);
  }
  function rideAlong(i: number) {
    const [x, y] = deps.position(i);
    follow = i;
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
    focus(i) {
      // Off the auto-fit, or the next tick overwrites the target from the bounds.
      autoFit = false;
      target.zoom = Math.max(target.zoom, FOCUS_ZOOM);
      const [x, y] = deps.position(i);
      const [ox, oy] = insetOffset(deps.inset(), target.zoom);
      target.x = x - ox;
      target.y = y + oy;
      // On an unsettled layout the node keeps moving after this, and a
      // one-shot target would park the camera where it used to be.
      rideAlong(i);
    },
    reveal(i) {
      const [x, y] = deps.position(i);
      const { width, height } = deps.viewport();
      const ins = deps.inset();
      // Where the node lands on screen once the camera reaches its target.
      // Ignores the CRT warp, which moves points by a few pixels at most; the
      // margin covers it.
      const sx = width / 2 + (x - target.x) * target.zoom;
      const sy = height / 2 - (y - target.y) * target.zoom;
      const inside =
        sx >= ins.left + REVEAL_MARGIN &&
        sx <= width - ins.right - REVEAL_MARGIN &&
        sy >= ins.top + REVEAL_MARGIN &&
        sy <= height - ins.bottom - REVEAL_MARGIN;
      if (inside) return;
      autoFit = false;
      const [ox, oy] = insetOffset(ins, target.zoom);
      target.x = x - ox;
      target.y = y + oy;
      rideAlong(i);
    },
    frameAround(i, neighbours) {
      const b = deps.bounds([i, ...neighbours]);
      if (!b) return fitToView();
      autoFit = false;
      frameBox(b);
      rideAlong(i);
    },
    release() {
      fitToView();
      autoFit = !userOwned;
    },
    reseed(reduced) {
      const sweep = !userOwned && !reduced;
      autoFit = true;
      userOwned = false;
      fitToView();
      if (sweep) live.zoom = sweepZoom();
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
      // Ride the followed node while the layout moves under it; once nothing
      // moves, release it and the camera is a plain static target again.
      if (follow >= 0) {
        if (settled) follow = -1;
        else if (stepped) {
          const [x, y] = deps.position(follow);
          target.x = x + followDX;
          target.y = y + followDY;
        }
      }
      // Track the settling layout. Only on frames physics stepped: with the
      // solver paused nothing moved, and the bounds scan would be waste.
      if (autoFit && stepped && !settled) {
        const b = deps.bounds();
        if (b) {
          const k = 1 - Math.pow(0.25, dt);
          fx0 += (b[0] - fx0) * k;
          fy0 += (b[1] - fy0) * k;
          fx1 += (b[2] - fx1) * k;
          fy1 += (b[3] - fy1) * k;
          frameBox([fx0, fy0, fx1, fy1]);
        }
      }
      // Under reduced motion every move lands at once: a camera gliding
      // across the canvas is the motion the setting asks to stop.
      if (reduced) {
        live.x = target.x;
        live.y = target.y;
        live.zoom = target.zoom;
        return;
      }
      const k = 1 - Math.pow(0.0045, dt);
      live.x += (target.x - live.x) * k;
      live.y += (target.y - live.y) * k;
      live.zoom += (target.zoom - live.zoom) * k;
    },
  };
}
