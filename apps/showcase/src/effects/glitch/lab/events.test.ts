import { describe, expect, it } from "vitest";
import { isEffectHot, randomEventIndex } from "./events.js";

describe("isEffectHot", () => {
  const running = [{ id: "dropout", label: "DROPOUT", u: 0.5 }];

  it("is true for an effect a running event has a track on", () => {
    expect(isEffectHot(running, "tracking")).toBe(true);
  });

  it("is false for an effect no running event touches", () => {
    expect(isEffectHot(running, "holo")).toBe(false);
  });

  it("is false with nothing running, or for an unknown event", () => {
    expect(isEffectHot([], "tracking")).toBe(false);
    expect(isEffectHot([{ id: "no-such-event", label: "", u: 0 }], "tracking")).toBe(false);
  });
});

describe("randomEventIndex", () => {
  it.each([
    [0, 0],
    [0.124, 0],
    [0.125, 1],
    [0.5, 4],
    [0.999999, 7],
  ])("random %s of 8 picks index %s", (random, index) => {
    expect(randomEventIndex(random, 8)).toBe(index);
  });
});
