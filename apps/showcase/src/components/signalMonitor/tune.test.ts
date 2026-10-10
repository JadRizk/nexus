import { describe, expect, it } from "vitest";
import { configFor } from "../../effects/glitch/core/config.js";
import { restingConfig, tuneFromPointer } from "./tune.js";

const rect = { left: 100, top: 50, width: 400, height: 200 };

describe("restingConfig", () => {
  it("is BROADCAST bent to the frame, at full mix, with no hologram flicker", () => {
    const config = restingConfig();
    expect(config.crt).toMatchObject({ amt: 1, curve: 0.9, overscan: 1 });
    expect(config.holo.flicker).toBe(0);
    expect(config.chroma).toEqual(configFor("BROADCAST").chroma);
  });

  it("returns a fresh object each time", () => {
    const first = restingConfig();
    first.crt.amt = 0;
    expect(restingConfig().crt.amt).toBe(1);
  });
});

describe("tuneFromPointer", () => {
  it("at the top-left corner turns colour bleed and tracking to their floor", () => {
    const config = tuneFromPointer(rect, 100, 50);
    expect(config.chroma).toMatchObject({ on: 1, amt: 0.5, width: 4, lag: -2 });
    expect(config.tracking).toMatchObject({ on: 1, amt: 0, shift: 0, height: 0.06 });
  });

  it("at the bottom-right corner turns both to their ceiling", () => {
    const config = tuneFromPointer(rect, 500, 250);
    expect(config.chroma).toMatchObject({ amt: 1, width: 24, lag: 10 });
    expect(config.tracking.amt).toBe(1);
    expect(config.tracking.shift).toBeCloseTo(0.12);
    expect(config.tracking.height).toBeCloseTo(0.24);
  });

  it("reads across for colour bleed and down for tracking, independently", () => {
    const config = tuneFromPointer(rect, 300, 100);
    expect(config.chroma.amt).toBeCloseTo(0.75);
    expect(config.tracking.amt).toBeCloseTo(0.25);
  });

  it("clamps a pointer outside the screen to its edge", () => {
    expect(tuneFromPointer(rect, -1000, 9999)).toEqual(tuneFromPointer(rect, 100, 250));
  });

  it("keeps the resting signal underneath", () => {
    const config = tuneFromPointer(rect, 300, 150);
    expect(config.crt).toEqual(restingConfig().crt);
    expect(config.holo).toEqual(restingConfig().holo);
  });
});
