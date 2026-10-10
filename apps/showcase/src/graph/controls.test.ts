import { describe, expect, it } from "vitest";
import { DEFAULT_OPTICS, DEFAULT_PHYSICS } from "@nexus-cyberdeck/graph";
import { DEFAULT_CONFIG, toOptics, toPhysics } from "./controls.js";

describe("toPhysics", () => {
  it("picks the four solver keys and nothing else", () => {
    expect(toPhysics(DEFAULT_CONFIG)).toEqual({
      repulsion: DEFAULT_PHYSICS.repulsion,
      linkDistance: DEFAULT_PHYSICS.linkDistance,
      cursorForce: DEFAULT_PHYSICS.cursorForce,
      settle: DEFAULT_PHYSICS.settle,
    });
  });

  it("follows a changed value", () => {
    expect(toPhysics({ ...DEFAULT_CONFIG, repulsion: 900 }).repulsion).toBe(900);
  });

  it("returns a fresh object each call", () => {
    expect(toPhysics(DEFAULT_CONFIG)).not.toBe(toPhysics(DEFAULT_CONFIG));
  });
});

describe("toOptics", () => {
  it("picks the eleven optics keys and nothing else", () => {
    const optics = toOptics(DEFAULT_CONFIG);
    expect(Object.keys(optics).sort()).toEqual(
      [
        "aberr",
        "bloom",
        "curve",
        "edgeOpacity",
        "edgeWidth",
        "flowSpeed",
        "glitch",
        "glow",
        "grain",
        "scan",
        "trails",
      ].sort(),
    );
    for (const [key, value] of Object.entries(optics))
      expect(value).toBe(DEFAULT_OPTICS[key as keyof typeof DEFAULT_OPTICS]);
  });

  it("follows a changed value", () => {
    expect(toOptics({ ...DEFAULT_CONFIG, glitch: 1.5 }).glitch).toBe(1.5);
  });

  it("returns a fresh object each call", () => {
    expect(toOptics(DEFAULT_CONFIG)).not.toBe(toOptics(DEFAULT_CONFIG));
  });
});
