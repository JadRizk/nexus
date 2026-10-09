import { describe, expect, it } from "vitest";
import type { EventDef, Track } from "../data/events/types.js";
import type { Key } from "../data/types.js";
import { chaosEnv } from "./chaosEnv.js";
import type { ActiveEvent } from "./events.js";
import { resolveEvents } from "./resolveEvents.js";

interface EventOptions {
  readonly id?: string;
  readonly dur?: number;
  readonly chaos?: number;
}

function eventDef(
  tracks: Track[],
  { id = "test", dur = 1, chaos = 0 }: EventOptions = {},
): EventDef {
  return { id, label: id.toUpperCase(), key: "0", dur, chaos, cause: "", tracks };
}

function started(def: EventDef, t0 = 0, seed = 0): ActiveEvent {
  return { def, t0, seed };
}

/** A track that reads `value` all the way through. */
function flat(value: number): Key[] {
  return [
    [0, value],
    [1, value],
  ];
}

describe("resolveEvents: stacking", () => {
  it("max takes the strongest of the stacked values", () => {
    const weak = eventDef([{ fx: "crt", param: "scan", mode: "max", keys: flat(0.3) }]);
    const strong = eventDef([{ fx: "crt", param: "scan", mode: "max", keys: flat(0.7) }]);

    const { overrides } = resolveEvents([started(weak), started(strong)], 0.5);

    expect(overrides.crt?.scan).toBe(0.7);
  });

  it("max floors at 0, so a negative value resolves to 0", () => {
    const negative = eventDef([{ fx: "crt", param: "scan", mode: "max", keys: flat(-0.5) }]);

    const { overrides } = resolveEvents([started(negative)], 0.5);

    expect(overrides.crt?.scan).toBe(0);
  });

  it("add sums the stacked values", () => {
    const first = eventDef([{ fx: "crt", param: "scan", mode: "add", keys: flat(0.25) }]);
    const second = eventDef([{ fx: "crt", param: "scan", mode: "add", keys: flat(0.5) }]);

    const { overrides } = resolveEvents([started(first), started(second)], 0.5);

    expect(overrides.crt?.scan).toBe(0.75);
  });

  it("set takes the oldest event's value when several stack", () => {
    const older = eventDef([{ fx: "crt", param: "scan", mode: "set", keys: flat(5) }]);
    const newer = eventDef([{ fx: "crt", param: "scan", mode: "set", keys: flat(9) }]);

    const { overrides } = resolveEvents([started(older), started(newer)], 0.5);

    expect(overrides.crt?.scan).toBe(5);
  });

  it("keeps each effect's knobs in their own layer", () => {
    const def = eventDef([
      { fx: "crt", param: "scan", mode: "set", keys: flat(0.4) },
      { fx: "chroma", param: "width", mode: "set", keys: flat(12) },
    ]);

    const { overrides } = resolveEvents([started(def)], 0.5);

    expect(overrides).toEqual({ crt: { scan: 0.4 }, chroma: { width: 12 } });
  });
});

describe("resolveEvents: sampling", () => {
  it("samples each track at the event's progress", () => {
    const ramp = eventDef(
      [
        {
          fx: "crt",
          param: "scan",
          mode: "set",
          keys: [
            [0, 0],
            [1, 1],
          ],
        },
      ],
      { dur: 2 },
    );

    const { overrides } = resolveEvents([started(ramp, 10)], 11);

    expect(overrides.crt?.scan).toBe(0.5);
  });

  it("a step key holds the previous value until its own time", () => {
    const stepped = eventDef([
      {
        fx: "crt",
        param: "scan",
        mode: "set",
        keys: [
          [0, 0],
          [0.5, 1, "step"],
          [1, 1],
        ],
      },
    ]);

    expect(resolveEvents([started(stepped)], 0.4).overrides.crt?.scan).toBe(0);
    expect(resolveEvents([started(stepped)], 0.6).overrides.crt?.scan).toBe(1);
  });

  it("the chaos envelope scales amt tracks", () => {
    const seed = 5;
    const envelope = chaosEnv(0.5, 0.5, seed);
    expect(envelope).toBeLessThan(1);
    const def = eventDef([{ fx: "crt", param: "amt", mode: "set", keys: flat(0.8) }], {
      chaos: 0.5,
    });

    const { overrides } = resolveEvents([started(def, 0, seed)], 0.5);

    expect(overrides.crt?.amt).toBe(0.8 * envelope);
  });

  it("the chaos envelope leaves every other knob unscaled", () => {
    const seed = 5;
    expect(chaosEnv(0.5, 0.5, seed)).toBeLessThan(1);
    const def = eventDef([{ fx: "crt", param: "scan", mode: "set", keys: flat(0.8) }], {
      chaos: 0.5,
    });

    const { overrides } = resolveEvents([started(def, 0, seed)], 0.5);

    expect(overrides.crt?.scan).toBe(0.8);
  });
});

describe("resolveEvents: the bus", () => {
  const scan = eventDef([{ fx: "crt", param: "scan", mode: "set", keys: flat(1) }]);

  it("removes an event once it reaches its end (u = 1)", () => {
    const bus = [started(scan, 0)];

    const { overrides, running } = resolveEvents(bus, 1);

    expect(bus).toEqual([]);
    expect(running).toEqual([]);
    expect(overrides).toEqual({});
  });

  it("keeps an event that has not started yet (u < 0), without running it", () => {
    const early = started(scan, 5);
    const bus = [early];

    const { overrides, running } = resolveEvents(bus, 4);

    expect(bus).toEqual([early]);
    expect(running).toEqual([]);
    expect(overrides).toEqual({});
  });

  it("lists the running events newest first, with their progress", () => {
    const older = eventDef([], { id: "older" });
    const newer = eventDef([], { id: "newer" });

    const { running } = resolveEvents([started(older, 0), started(newer, 0.5)], 0.75);

    expect(running).toEqual([
      { id: "newer", label: "NEWER", u: 0.25 },
      { id: "older", label: "OLDER", u: 0.75 },
    ]);
  });

  it("removes finished events from the array it is given, keeping the others in order", () => {
    const first = started(scan, 0.5);
    const finished = started(scan, 0);
    const last = started(scan, 0.6);
    const bus = [first, finished, last];

    resolveEvents(bus, 1.2);

    expect(bus).toHaveLength(2);
    expect(bus[0]).toBe(first);
    expect(bus[1]).toBe(last);
  });
});

describe("resolveEvents: current behaviour to review (#91)", () => {
  const scan = eventDef([{ fx: "crt", param: "scan", mode: "set", keys: flat(1) }]);

  it("currently keeps an event fired on the wall clock forever when the loop's clock is a still frame's", () => {
    // fireEvent stamps t0 from performance.now(); a still frame resolves at 2.5 s.
    const fired = started(scan, 1500);
    const bus = [fired];

    for (let frame = 0; frame < 3; frame++) resolveEvents(bus, 2.5);

    expect(bus).toEqual([fired]);
    expect(resolveEvents(bus, 2.5).running).toEqual([]);
  });

  it("currently runs a dur-0 event at its own start time, with u = NaN", () => {
    const instant = eventDef([{ fx: "crt", param: "scan", mode: "set", keys: flat(1) }], {
      dur: 0,
    });
    const bus = [started(instant, 3)];

    const { overrides, running } = resolveEvents(bus, 3);

    expect(bus).toHaveLength(1);
    expect(running).toEqual([{ id: "test", label: "TEST", u: NaN }]);
    expect(overrides.crt?.scan).toBe(1);
  });

  it("currently removes a dur-0 event on any frame after its start", () => {
    const instant = eventDef([], { dur: 0 });
    const bus = [started(instant, 3)];

    resolveEvents(bus, 3.001);

    expect(bus).toEqual([]);
  });
});
