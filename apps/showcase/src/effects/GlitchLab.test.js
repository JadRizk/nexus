import { describe, expect, it } from "vitest";
import { chaosEnv, hashf, sampleKeys } from "./GlitchLab.jsx";

describe("sampleKeys", () => {
  const keys = [
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

  it('a "step" key holds the previous value through its own boundary, then the next segment starts from the new one', () => {
    const stepped = [
      [0, 0],
      [0.5, 1, "step"],
      [1, 0],
    ];
    expect(sampleKeys(stepped, 0.49)).toBe(0); // still holding the pre-jump value
    expect(sampleKeys(stepped, 0.5)).toBe(0); // still holding, exactly at the boundary
    expect(sampleKeys(stepped, 0.5001)).toBeCloseTo(1, 2); // the instant after: now interpolating from the new value
    expect(sampleKeys(stepped, 0.75)).toBeCloseTo(0.5); // halfway through the un-stepped segment that follows
  });
});

describe("chaosEnv", () => {
  it("is a no-op — always exactly 1 — when chaos is zero", () => {
    for (const u of [0, 0.1, 0.5, 0.9, 1]) {
      expect(chaosEnv(u, 0, 42)).toBe(1);
    }
  });

  it("never exceeds 1 — a fault can only ever dip the envelope, not exceed its peak", () => {
    for (let u = 0; u <= 1; u += 0.01) {
      expect(chaosEnv(u, 0.8, 7)).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for a given (u, chaos, seed) triple", () => {
    expect(chaosEnv(0.42, 0.5, 3)).toBe(chaosEnv(0.42, 0.5, 3));
  });

  it("is quantised to ~24Hz — two u values in the same 1/24 window agree", () => {
    // 0.10 and 0.11 both fall in floor(u*24) === 2
    expect(Math.floor(0.1 * 24)).toBe(Math.floor(0.11 * 24));
    expect(chaosEnv(0.1, 0.6, 5)).toBe(chaosEnv(0.11, 0.6, 5));
  });
});

describe("hashf", () => {
  it("stays within [0, 1)", () => {
    for (const n of [0, 1, 7.13, 1000, -42, 0.0001]) {
      const v = hashf(n);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic", () => {
    expect(hashf(12.34)).toBe(hashf(12.34));
  });
});
