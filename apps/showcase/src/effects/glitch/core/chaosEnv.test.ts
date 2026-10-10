import { describe, expect, it } from "vitest";
import { chaosEnv } from "./chaosEnv.js";

describe("chaosEnv", () => {
  it("is a no-op — always exactly 1 — when chaos is zero", () => {
    for (const u of [0, 0.1, 0.5, 0.9, 1]) {
      expect(chaosEnv(u, 0, 42)).toBe(1);
    }
  });

  it("is a no-op when chaos is negative", () => {
    expect(chaosEnv(0.5, -1, 123)).toBe(1);
  });

  it("never exceeds 1 — a fault can only ever dip the envelope, not exceed its peak", () => {
    for (let u = 0; u <= 1; u += 0.01) {
      expect(chaosEnv(u, 0.8, 7)).toBeLessThanOrEqual(1);
    }
  });

  it("dips below 1 somewhere in an event with chaos", () => {
    const values = Array.from({ length: 24 }, (_, frame) => chaosEnv(frame / 24, 0.8, 7));
    expect(Math.min(...values)).toBeLessThan(1);
  });

  it("cuts deeper the higher the chaos", () => {
    // Seed 5 dips at u = 0.5.
    expect(chaosEnv(0.5, 1, 5)).toBeLessThan(chaosEnv(0.5, 0.5, 5));
  });

  it("is quantised to ~24 Hz — two u values in the same 1/24 window agree", () => {
    // 0.10 and 0.11 both fall in floor(u * 24) === 2.
    expect(Math.floor(0.1 * 24)).toBe(Math.floor(0.11 * 24));
    expect(chaosEnv(0.1, 0.6, 5)).toBe(chaosEnv(0.11, 0.6, 5));
  });

  it("is 1 for a negative u", () => {
    expect([-0.01, -0.5, -1].map((u) => chaosEnv(u, 1, 250))).toEqual([1, 1, 1]);
  });

  it.each([
    [0, 1, 0, 1],
    [42 / 48, 1, 0, 0.03212173278552655],
    [30 / 48, 1, 250, 0.13044870280355103],
    [1, 1, 250, 0.5924549167921214],
    [0.25, 1, 999.5, 0.4509635344968046],
    [0.5, 1, 999.5, 0.02128711114957016],
    [30 / 48, 0.8, 250, 0.30435896224284076],
    [30 / 48, 0.5, 250, 0.5652243514017755],
    [1, 0.5, 250, 0.7962274583960607],
  ])("chaosEnv(%s, %s, %s) is exactly %s", (u, chaos, seed, expected) => {
    expect(chaosEnv(u, chaos, seed)).toBe(expected);
  });
});
