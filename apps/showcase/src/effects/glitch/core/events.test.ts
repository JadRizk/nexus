import { afterEach, describe, expect, it, vi } from "vitest";
import { EV_BY_ID } from "../data/events/index.js";
import type { ActiveEvent } from "./events.js";
import { fireEvent, shuffleSeed } from "./events.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fireEvent", () => {
  it("appends a known event, stamped with the clock in seconds and a seed scaled to 0–1000", () => {
    const bus: ActiveEvent[] = [];

    fireEvent(
      { current: bus },
      "crash",
      () => 2500,
      () => 0.5,
    );

    expect(bus).toEqual([{ def: EV_BY_ID.crash, t0: 2.5, seed: 500 }]);
  });

  it("returns the event's definition", () => {
    expect(fireEvent({ current: [] }, "crash")).toBe(EV_BY_ID.crash);
  });

  it("keeps the events already on the bus", () => {
    const bus: ActiveEvent[] = [];
    fireEvent({ current: bus }, "boot");
    fireEvent({ current: bus }, "crash");
    expect(bus.map((event) => event.def.id)).toEqual(["boot", "crash"]);
  });

  it("ignores an unknown id and returns undefined", () => {
    const bus: ActiveEvent[] = [];
    expect(fireEvent({ current: bus }, "no-such-event")).toBeUndefined();
    expect(bus).toEqual([]);
  });

  it("defaults to performance.now and Math.random, looked up at each call", () => {
    vi.spyOn(performance, "now").mockReturnValue(1500);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const bus: ActiveEvent[] = [];

    fireEvent({ current: bus }, "crash");

    expect(bus[0]).toMatchObject({ t0: 1.5, seed: 250 });
  });
});

describe("shuffleSeed", () => {
  it.each([
    [0, 1],
    [0.5, 499],
    [0.999999, 997],
  ])("maps Math.random() = %s to seed %s, so the seed is 1–997 and never 0", (random, seed) => {
    vi.spyOn(Math, "random").mockReturnValue(random);
    const seedRef = { current: 0 };
    shuffleSeed(seedRef);
    expect(seedRef.current).toBe(seed);
  });
});
