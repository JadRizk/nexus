import { describe, expect, it } from "vitest";
import { hashf } from "./hash.js";

describe("hashf", () => {
  it("stays within [0, 1)", () => {
    for (const n of [0, 1, 7.13, 1000, -42, 0.0001]) {
      const value = hashf(n);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads nearby inputs apart", () => {
    expect(hashf(1)).not.toBeCloseTo(hashf(1.001), 2);
  });

  it("currently gives NaN for an infinite input", () => {
    expect(hashf(Infinity)).toBeNaN();
  });
});
