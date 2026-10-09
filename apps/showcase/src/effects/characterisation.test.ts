import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAINS,
  COMMON,
  chaosEnv,
  configFor,
  EFFECTS,
  EV_BY_ID,
  EVENTS,
  fireEvent,
  hashf,
  PRESETS,
  SRC_FS,
  sampleKeys,
  shuffleSeed,
} from "./glitchEngine.js";

/* ============================================================================
   Characterisation of the Glitch Lab engine.

   These tests freeze what the engine does today, right or wrong, so the move
   to TypeScript can prove it changed nothing. They assert behaviour, not
   intent: a snapshot that looks like a bug is still the behaviour to keep
   until a later change fixes it on purpose. Only the import path above should
   change as the engine moves.
   ========================================================================== */

type Ref<T> = { current: T };

/** Values from `from` to `to` inclusive, each divided by `steps`. */
function fractions(from: number, to: number, steps: number): number[] {
  const values: number[] = [];
  for (let k = from; k <= to; k++) values.push(k / steps);
  return values;
}

function stubClock(milliseconds: number) {
  vi.spyOn(performance, "now").mockReturnValue(milliseconds);
}

function stubRandom(value: number) {
  vi.spyOn(Math, "random").mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("engine data", () => {
  // Snapshots sort object keys, so reordering keys still compares equal;
  // array order still counts.
  it("EFFECTS", () => {
    expect(EFFECTS).toMatchSnapshot();
  });

  it("EVENTS", () => {
    expect(EVENTS).toMatchSnapshot();
  });

  it("CHAINS", () => {
    expect(CHAINS).toMatchSnapshot();
  });

  it("PRESETS", () => {
    expect(PRESETS).toMatchSnapshot();
  });

  it("SRC_FS", () => {
    expect(SRC_FS).toMatchSnapshot();
  });

  it("COMMON", () => {
    expect(COMMON).toMatchSnapshot();
  });

  it("EV_BY_ID has exactly the EVENTS ids as keys", () => {
    expect(Object.keys(EV_BY_ID).sort()).toEqual(EVENTS.map((event) => event.id).sort());
  });

  it("EV_BY_ID maps each id to the same object as in EVENTS", () => {
    for (const event of EVENTS) expect(EV_BY_ID[event.id]).toBe(event);
  });
});

describe("sampleKeys", () => {
  it("samples every event track from just before its start to just after its end", () => {
    const samples: Record<string, number[]> = {};
    for (const event of EVENTS) {
      event.tracks.forEach((track, index) => {
        const name = `${event.id} #${index} ${track.fx}.${track.param}`;
        samples[name] = fractions(-1, 65, 64).map((u) => sampleKeys(track.keys, u));
      });
    }
    expect(samples).toMatchSnapshot();
  });

  it("a one-key track", () => {
    const track = [[0.5, 3]];
    expect([0, 0.5, 1].map((u) => sampleKeys(track, u))).toMatchSnapshot();
  });

  it("two keys at the same time", () => {
    const track = [
      [0, 0],
      [0.5, 1],
      [0.5, 2],
      [1, 3],
    ];
    expect([0.25, 0.5, 0.75].map((u) => sampleKeys(track, u))).toMatchSnapshot();
  });

  it("a step key in the last position", () => {
    const track = [
      [0, 0],
      [0.5, 1],
      [1, 2, "step"],
    ];
    expect([0.5, 0.75, 1, 1.5].map((u) => sampleKeys(track, u))).toMatchSnapshot();
  });

  it("u = NaN", () => {
    const track = [
      [0, 0],
      [0.5, 1],
      [1, 2],
    ];
    expect(sampleKeys(track, NaN)).toMatchSnapshot();
  });

  it("an empty track throws", () => {
    expect(() => sampleKeys([], 0.5)).toThrow();
  });
});

describe("hashf", () => {
  it("values at fixed inputs", () => {
    const inputs = [0, 1, -1, 7.13, 1e6, NaN, Infinity];
    expect(inputs.map((input) => [input, hashf(input)])).toMatchSnapshot();
  });
});

describe("chaosEnv", () => {
  it("chaos 0 returns 1", () => {
    expect(chaosEnv(0.5, 0, 123)).toBe(1);
  });

  it("negative chaos returns 1", () => {
    expect(chaosEnv(0.5, -1, 123)).toBe(1);
  });

  it("a grid of u, every event's chaos plus 1, and three seeds", () => {
    const chaosLevels: Array<[string, number]> = [
      ...EVENTS.map((event): [string, number] => [event.id, event.chaos]),
      ["full", 1],
    ];
    const grid: Record<string, number[]> = {};
    for (const [name, chaos] of chaosLevels) {
      for (const seed of [0, 250, 999.5]) {
        grid[`${name} chaos=${chaos} seed=${seed}`] = fractions(0, 48, 48).map((u) =>
          chaosEnv(u, chaos, seed),
        );
      }
    }
    expect(grid).toMatchSnapshot();
  });

  it("negative u", () => {
    const values = [-0.01, -0.5, -1].map((u) => chaosEnv(u, 1, 250));
    expect(values).toMatchSnapshot();
  });
});

describe("configFor", () => {
  it("the config for each preset", () => {
    const configs = Object.fromEntries(
      Object.keys(PRESETS).map((preset) => [preset, configFor(preset)]),
    );
    expect(configs).toMatchSnapshot();
  });

  it("returns a fresh object on each call", () => {
    const first = configFor("CLEAN");
    const second = configFor("CLEAN");
    expect(first).not.toBe(second);
    expect(first.crt).not.toBe(second.crt);
  });

  it("mutating a result leaves PRESETS unchanged", () => {
    const before = structuredClone(PRESETS);
    for (const preset of Object.keys(PRESETS)) {
      const config = configFor(preset);
      for (const knobs of Object.values(config)) {
        for (const knob of Object.keys(knobs)) knobs[knob] = -999;
      }
    }
    expect(PRESETS).toEqual(before);
  });

  it("an unknown preset throws a TypeError", () => {
    expect(() => configFor("NO SUCH PRESET")).toThrow(TypeError);
  });
});

describe("fireEvent", () => {
  it("a known id appends the event at the current time and returns its definition", () => {
    stubClock(1500);
    stubRandom(0.25);
    const activeRef: Ref<unknown[]> = { current: [] };
    const id = EVENTS[0].id;

    const def = fireEvent(activeRef, id);

    expect(def).toBe(EV_BY_ID[id]);
    expect(activeRef.current).toHaveLength(1);
    expect(activeRef.current[0]).toEqual({ def: EV_BY_ID[id], t0: 1.5, seed: 250 });
    expect((activeRef.current[0] as { def: unknown }).def).toBe(EV_BY_ID[id]);
  });

  it("an unknown id returns undefined and leaves the bus unchanged", () => {
    stubClock(1500);
    stubRandom(0.25);
    const existing = { marker: true };
    const activeRef: Ref<unknown[]> = { current: [existing] };

    expect(fireEvent(activeRef, "no-such-event")).toBeUndefined();
    expect(activeRef.current).toEqual([existing]);
    expect(activeRef.current[0]).toBe(existing);
  });
});

describe("shuffleSeed", () => {
  it.each([
    [0, 1],
    [0.5, 499],
    [0.999999, 997],
  ])("Math.random() = %s gives seed %s", (random, seed) => {
    stubRandom(random);
    const seedRef: Ref<number> = { current: 0 };
    shuffleSeed(seedRef);
    expect(seedRef.current).toBe(seed);
  });
});
