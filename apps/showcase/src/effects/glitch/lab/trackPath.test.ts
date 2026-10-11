import { describe, expect, it } from "vitest";
import type { Key } from "../data/types.js";
import { trackColor, trackPath } from "./trackPath.js";

const view = { width: 100, height: 49, samples: 4 };

describe("trackPath", () => {
  it("moves to the first sample, then draws a line through each, scaled to the track's range", () => {
    const keys: Key[] = [
      [0, 2],
      [1, 6],
    ];
    expect(trackPath(keys, view)).toBe("M0.0,45.0L25.0,35.0L50.0,25.0L75.0,15.0L100.0,5.0");
  });

  it("draws a flat track at mid-height", () => {
    expect(trackPath([[0.5, 3]], view)).toBe("M0.0,25.0L25.0,25.0L50.0,25.0L75.0,25.0L100.0,25.0");
  });

  it("follows step keys", () => {
    const keys: Key[] = [
      [0, 0],
      [0.5, 1, "step"],
      [1, 1],
    ];
    expect(trackPath(keys, view)).toBe("M0.0,45.0L25.0,45.0L50.0,45.0L75.0,5.0L100.0,5.0");
  });

  it("throws a TypeError for an empty track", () => {
    expect(() => trackPath([], view)).toThrow(TypeError);
  });
});

describe("trackColor", () => {
  it("cycles through eight colours", () => {
    expect(trackColor(0)).toBe("var(--nx-fg-accent)");
    expect(trackColor(7)).toBe("#3AC6D4");
    expect(trackColor(8)).toBe(trackColor(0));
  });
});
