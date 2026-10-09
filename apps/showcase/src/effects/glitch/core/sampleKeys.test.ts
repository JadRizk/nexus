import { describe, expect, it } from "vitest";
import type { Key } from "../data/types.js";
import { sampleKeys } from "./sampleKeys.js";

describe("sampleKeys", () => {
  const keys: Key[] = [
    [0, 0],
    [0.5, 1],
    [1, 0],
  ];

  it("clamps to the first key's value before the track starts", () => {
    expect(sampleKeys(keys, -1)).toBe(0);
  });

  it("clamps to the last key's value after the track ends", () => {
    expect(sampleKeys(keys, 2)).toBe(0);
  });

  it("interpolates linearly between two keys", () => {
    expect(sampleKeys(keys, 0.25)).toBeCloseTo(0.5);
    expect(sampleKeys(keys, 0.75)).toBeCloseTo(0.5);
  });

  it("returns the exact value at a keyframe", () => {
    expect(sampleKeys(keys, 0.5)).toBe(1);
  });

  it("reads a one-key track as that key's value everywhere", () => {
    const single: Key[] = [[0.5, 3]];
    expect([0, 0.5, 1].map((u) => sampleKeys(single, u))).toEqual([3, 3, 3]);
  });

  it('a "step" key holds the previous value through its own time, then the next segment starts from its value', () => {
    const stepped: Key[] = [
      [0, 0],
      [0.5, 1, "step"],
      [1, 0],
    ];
    expect(sampleKeys(stepped, 0.49)).toBe(0);
    expect(sampleKeys(stepped, 0.5)).toBe(0);
    expect(sampleKeys(stepped, 0.5001)).toBeCloseTo(1, 2);
    expect(sampleKeys(stepped, 0.75)).toBeCloseTo(0.5);
  });

  it("throws a TypeError for an empty track", () => {
    expect(() => sampleKeys([], 0.5)).toThrow(TypeError);
  });

  it("currently ignores a step flag on the first key", () => {
    const stepFirst: Key[] = [
      [0.5, 1, "step"],
      [1, 3],
    ];
    expect(sampleKeys(stepFirst, 0.25)).toBe(1);
    expect(sampleKeys(stepFirst, 0.75)).toBe(2);
  });

  it("currently returns the last key's value for u = NaN", () => {
    const rising: Key[] = [
      [0, 0],
      [0.5, 1],
      [1, 2],
    ];
    expect(sampleKeys(rising, NaN)).toBe(2);
  });
});
