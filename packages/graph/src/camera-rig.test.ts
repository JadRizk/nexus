import { beforeEach, describe, expect, it } from "vitest";
import { createCameraRig, FOCUS_ZOOM, INTRO_ZOOM_MULTIPLIER } from "./camera-rig.js";
import type { Bounds, CameraRig } from "./camera-rig.js";
import { fitBounds, ZOOM_MAX } from "./camera.js";
import type { FitInset } from "./camera.js";

const WIDTH = 800,
  HEIGHT = 600;

let positions: Array<[number, number]>;
let inset: FitInset;
let rig: CameraRig;

function boundsOf(indices?: readonly number[]): Bounds | null {
  const ids = indices ?? positions.map((_, i) => i);
  if (ids.length === 0) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const i of ids) {
    const [x, y] = positions[i];
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

const STEP = { dt: 1 / 60, stepped: true, settled: false, reduced: false };
const SETTLED = { ...STEP, stepped: false, settled: true };

beforeEach(() => {
  positions = [
    [-100, -50],
    [100, 50],
    [0, 0],
    [40, 10],
  ];
  inset = { top: 0, right: 0, bottom: 0, left: 0 };
  rig = createCameraRig({
    bounds: boundsOf,
    position: (i) => positions[i],
    viewport: () => ({ width: WIDTH, height: HEIGHT }),
    inset: () => inset,
  });
});

function expand(factor: number) {
  positions = positions.map(([x, y]) => [x * factor, y * factor]);
}

describe("intro", () => {
  it("targets the measured fit and starts the live zoom tighter, for the sweep", () => {
    rig.intro(false);
    const fit = fitBounds(-100, -50, 100, 50, WIDTH, HEIGHT);
    expect(rig.target).toEqual({ x: fit.x, y: fit.y, zoom: fit.zoom });
    expect(rig.live.zoom).toBeCloseTo(Math.min(ZOOM_MAX, fit.zoom * INTRO_ZOOM_MULTIPLIER));
    expect([rig.live.x, rig.live.y]).toEqual([rig.target.x, rig.target.y]);
  });

  it("never starts the sweep past ZOOM_MAX, however small the graph", () => {
    // Two nodes a unit apart fit at ZOOM_MAX already; six times that is no zoom at all.
    positions = [
      [0, 0],
      [1, 0],
    ];
    rig.intro(false);
    expect(rig.target.zoom).toBe(ZOOM_MAX);
    expect(rig.live.zoom).toBe(ZOOM_MAX);
    rig.reseed(false);
    expect(rig.live.zoom).toBe(ZOOM_MAX);
  });

  it("starts on the fit with no sweep under reduced motion", () => {
    rig.intro(true);
    expect(rig.live).toEqual(rig.target);
  });
});

describe("auto-fit", () => {
  it("tracks the layout's bounds while the solver is moving", () => {
    rig.intro(true);
    const before = rig.target.zoom;
    expand(3);
    for (let i = 0; i < 240; i++) rig.tick(STEP);
    expect(rig.target.zoom).toBeLessThan(before);
    expect(rig.target.zoom).toBeCloseTo(fitBounds(-300, -150, 300, 150, WIDTH, HEIGHT).zoom, 2);
  });

  it("absorbs a one-frame spike instead of zooming with it", () => {
    rig.intro(true);
    const before = rig.target.zoom;
    expand(5);
    rig.tick(STEP);
    expect(rig.target.zoom).toBeGreaterThan(before * 0.9);
  });

  it("does nothing on frames the solver didn't step, or once it has settled", () => {
    rig.intro(true);
    const targetBefore = { ...rig.target };
    expand(3);
    rig.tick({ ...STEP, stepped: false });
    rig.tick(SETTLED);
    expect(rig.target).toEqual(targetBefore);
  });

  it("ends when the reader pans or zooms", () => {
    rig.intro(true);
    rig.takeOver();
    const targetBefore = { ...rig.target };
    expand(3);
    for (let i = 0; i < 60; i++) rig.tick(STEP);
    expect(rig.target).toEqual(targetBefore);
    expect(rig.autoFit).toBe(false);
    expect(rig.userOwned).toBe(true);
  });

  it("comes back with an explicit fit()", () => {
    rig.intro(true);
    rig.takeOver();
    rig.fit();
    expect(rig.autoFit).toBe(true);
    expect(rig.userOwned).toBe(false);
  });
});

describe("fitInset", () => {
  it("re-frames into the new free box while the auto-fit owns the camera", () => {
    rig.intro(true);
    const before = rig.target.x;
    inset = { top: 0, right: 300, bottom: 0, left: 0 };
    rig.reframe();
    expect(rig.target.x).toBeGreaterThan(before);
  });

  it("leaves a hand-picked framing alone", () => {
    rig.intro(true);
    rig.takeOver();
    const targetBefore = { ...rig.target };
    inset = { top: 0, right: 300, bottom: 0, left: 0 };
    rig.reframe();
    expect(rig.target).toEqual(targetBefore);
  });
});

describe("focus", () => {
  it("centres the node in the free box, zoomed in to at least FOCUS_ZOOM", () => {
    inset = { top: 0, right: 200, bottom: 0, left: 0 };
    rig.intro(true);
    rig.focus(3);
    expect(rig.autoFit).toBe(false);
    expect(rig.target.zoom).toBeGreaterThanOrEqual(FOCUS_ZOOM);
    // On screen, the node lands at the free box's centre: (800 - 200) / 2.
    const screenX = WIDTH / 2 + (positions[3][0] - rig.target.x) * rig.target.zoom;
    expect(screenX).toBeCloseTo(300);
  });

  it("rides along with the node while the layout moves, then lets go once it settles", () => {
    rig.intro(true);
    rig.focus(3);
    const dx = rig.target.x - positions[3][0];
    positions[3] = [500, 400];
    rig.tick(STEP);
    expect(rig.target.x - positions[3][0]).toBeCloseTo(dx);
    rig.tick(SETTLED);
    expect(rig.follow).toBe(-1);
    positions[3] = [900, 900];
    rig.tick(STEP);
    expect(rig.target.x).not.toBeCloseTo(900 + dx);
  });

  it("stops riding along when the reader takes over", () => {
    rig.intro(true);
    rig.focus(3);
    rig.takeOver();
    const targetBefore = { ...rig.target };
    positions[3] = [500, 400];
    rig.tick(STEP);
    expect(rig.target).toEqual(targetBefore);
  });
});

describe("selection framing", () => {
  it("frames the node and its neighbours and rides along with the node", () => {
    rig.intro(true);
    rig.frameAround(2, [3]);
    const fit = fitBounds(0, 0, 40, 10, WIDTH, HEIGHT);
    expect(rig.target.zoom).toBeCloseTo(fit.zoom);
    expect(rig.follow).toBe(2);
    expect(rig.autoFit).toBe(false);
  });

  it("returns to tracking the whole graph when released", () => {
    rig.intro(true);
    rig.frameAround(2, [3]);
    rig.release();
    expect(rig.autoFit).toBe(true);
    expect(rig.follow).toBe(-1);
    expect(rig.target.zoom).toBeCloseTo(fitBounds(-100, -50, 100, 50, WIDTH, HEIGHT).zoom);
  });

  it("frames the whole graph on release but stays put if the reader had taken over", () => {
    rig.intro(true);
    rig.takeOver();
    rig.frameAround(2, [3]);
    rig.release();
    expect(rig.autoFit).toBe(false);
  });
});

describe("reseed", () => {
  it("sweeps in again when the camera never left the auto-fit", () => {
    rig.intro(false);
    for (let i = 0; i < 600; i++) rig.tick(STEP);
    rig.reseed(false);
    expect(rig.live.zoom).toBeCloseTo(Math.min(ZOOM_MAX, rig.target.zoom * INTRO_ZOOM_MULTIPLIER));
    expect(rig.autoFit).toBe(true);
  });

  it("re-fits in place, with no sweep, once the reader has taken the camera", () => {
    rig.intro(false);
    rig.takeOver();
    const liveZoom = rig.live.zoom;
    rig.reseed(false);
    expect(rig.live.zoom).toBe(liveZoom);
    expect(rig.autoFit).toBe(true);
    expect(rig.userOwned).toBe(false);
  });

  it("never sweeps under reduced motion", () => {
    rig.intro(true);
    const liveZoom = rig.live.zoom;
    rig.reseed(true);
    expect(rig.live.zoom).toBe(liveZoom);
  });
});

describe("easing", () => {
  it("eases the live camera toward the target", () => {
    rig.intro(false);
    const start = rig.live.zoom;
    rig.tick({ ...SETTLED });
    expect(rig.live.zoom).toBeLessThan(start);
    expect(rig.live.zoom).toBeGreaterThan(rig.target.zoom);
  });

  it("lands at once under reduced motion", () => {
    rig.intro(false);
    rig.tick({ ...SETTLED, reduced: true });
    expect(rig.live).toEqual(rig.target);
  });

  it("pans the live camera and the target together, so a drag tracks 1:1", () => {
    rig.intro(true);
    const { x, y } = rig.live;
    rig.panBy(10, -5);
    expect([rig.live.x, rig.live.y]).toEqual([x + 10, y - 5]);
    expect([rig.target.x, rig.target.y]).toEqual([x + 10, y - 5]);
  });
});

describe("reveal", () => {
  it("leaves the camera alone when the node is already in view", () => {
    rig.intro(true);
    const targetBefore = { ...rig.target };
    rig.reveal(2);
    expect(rig.target).toEqual(targetBefore);
    expect(rig.autoFit).toBe(true);
  });

  it("pans, at the same zoom, to bring an off-screen node into the free box, and rides along", () => {
    rig.intro(true);
    positions.push([5000, 0]);
    const zoom = rig.target.zoom;
    rig.reveal(4);
    expect(rig.target.zoom).toBe(zoom);
    expect(rig.target.x).toBeCloseTo(5000);
    expect(rig.autoFit).toBe(false);
    expect(rig.follow).toBe(4);
  });

  it("counts a node under the floating chrome as out of view", () => {
    rig.intro(true);
    // A node at the left edge of the canvas, under a 300px left panel.
    const zoom = rig.target.zoom;
    positions.push([rig.target.x - (WIDTH / 2 - 20) / zoom, rig.target.y]);
    inset = { top: 0, right: 0, bottom: 0, left: 300 };
    rig.reveal(4);
    const screenX = WIDTH / 2 + (positions[4][0] - rig.target.x) * rig.target.zoom;
    expect(screenX).toBeCloseTo(300 + (WIDTH - 300) / 2);
  });
});
