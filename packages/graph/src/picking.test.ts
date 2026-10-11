import { describe, expect, it } from "vitest";
import { pickNode } from "./picking.js";

describe("pickNode", () => {
  it("picks a node when the point is inside its radius, and misses when well outside", () => {
    const positions = new Float32Array([0, 0]);
    const radii = new Float32Array([10]);
    const hidden = new Float32Array([0]);
    expect(pickNode(2, 0, 1, positions, radii, hidden, 1)).toBe(0);
    expect(pickNode(500, 500, 1, positions, radii, hidden, 1)).toBe(-1);
  });

  it("with two overlapping candidates, the nearer centre wins, not the first in index order", () => {
    const positions = new Float32Array([0, 0, 5, 0]);
    const radii = new Float32Array([20, 20]);
    const hidden = new Float32Array([0, 0]);
    expect(pickNode(5, 0, 2, positions, radii, hidden, 1)).toBe(1);
  });

  it("never picks a hidden node, even when it is nearest and a visible node is further away", () => {
    const positions = new Float32Array([0, 0, 20, 0]);
    const radii = new Float32Array([10, 10]);
    const hidden = new Float32Array([1, 0]);
    expect(pickNode(2, 0, 2, positions, radii, hidden, 1)).toBe(1);
  });

  it("the grab margin scales with zoom, and stops shrinking at the 5-unit floor", () => {
    const positions = new Float32Array([0, 0]);
    const radii = new Float32Array([10]);
    const hidden = new Float32Array([0]);
    // The grab margin is 12 / zoom world units, floored at 5.
    expect(pickNode(13, 0, 1, positions, radii, hidden, 1)).toBe(0);
    expect(pickNode(14.5, 0, 1, positions, radii, hidden, 60)).toBe(0);
    expect(pickNode(16, 0, 1, positions, radii, hidden, 60)).toBe(-1);
    expect(pickNode(16, 0, 1, positions, radii, hidden, 6000)).toBe(-1);
  });

  // WCAG 2.5.8's 24px target, across the zoom range fit-to-view can land on (0.12–16).
  it.each([0.12, 0.5, 1, 2.4, 2.5, 8, 16])(
    "keeps a hit radius of at least 12 screen px at zoom %s",
    (zoom) => {
      const positions = new Float32Array([0, 0]);
      const radii = new Float32Array([0]);
      const hidden = new Float32Array([0]);
      const justInside = 11.99 / zoom;
      expect(pickNode(justInside, 0, 1, positions, radii, hidden, zoom)).toBe(0);
    },
  );
});
