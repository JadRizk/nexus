import { afterEach, describe, expect, it, vi } from "vitest";
import { EV_BY_ID, EVENTS } from "../data/events/index.js";
import type { QueuedEvent } from "./bus.js";
import { drainQueue, stepAutoFire } from "./bus.js";
import type { ActiveEvent } from "./events.js";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A voice that records what it fired, and a log both it and Math.random write to. */
function recorder() {
  const log: string[] = [];
  const voice = { fire: (id: string) => log.push(`fire ${id}`) };
  const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  vi.spyOn(Math, "random").mockImplementation(() => {
    const value = values.shift() ?? 0;
    log.push(`random ${value}`);
    return value;
  });
  return { log, voice };
}

describe("drainQueue", () => {
  it("starts the entries due at or before `time`, stamped with it, and keeps the rest queued", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const queue: QueuedEvent[] = [
      { id: "boot", at: 1 },
      { id: "crash", at: 2 },
      { id: "scrub", at: 2.5 },
    ];
    const active: ActiveEvent[] = [];

    drainQueue(queue, active, 2, null);

    expect(queue).toEqual([{ id: "scrub", at: 2.5 }]);
    expect(active).toEqual([
      { def: EV_BY_ID.crash, t0: 2, seed: 500 },
      { def: EV_BY_ID.boot, t0: 2, seed: 500 },
    ]);
  });

  it("drops a due entry with an unknown id, without a seed or a sound", () => {
    const { log, voice } = recorder();
    const queue: QueuedEvent[] = [{ id: "no-such-event", at: 0 }];
    const active: ActiveEvent[] = [];

    drainQueue(queue, active, 1, voice);

    expect(queue).toEqual([]);
    expect(active).toEqual([]);
    expect(log).toEqual([]);
  });

  it("draws each seed, then voices that event, from the end of the queue", () => {
    const { log, voice } = recorder();
    const queue: QueuedEvent[] = [
      { id: "boot", at: 0 },
      { id: "crash", at: 0 },
    ];
    const active: ActiveEvent[] = [];

    drainQueue(queue, active, 0, voice);

    expect(log).toEqual(["random 0.1", "fire crash", "random 0.2", "fire boot"]);
    expect(active.map((event) => [event.def.id, event.seed])).toEqual([
      ["crash", 100],
      ["boot", 200],
    ]);
  });

  it("leaves the bus alone when nothing is due", () => {
    const queue: QueuedEvent[] = [{ id: "boot", at: 5 }];
    const active: ActiveEvent[] = [];

    drainQueue(queue, active, 4.999, null);

    expect(queue).toHaveLength(1);
    expect(active).toEqual([]);
  });
});

describe("stepAutoFire", () => {
  const step = (active: ActiveEvent[], voice: { fire(id: string): unknown } | null = null) => ({
    active,
    time: 3,
    dt: 0.05,
    rate: 0.5,
    voice,
  });

  it("counts down by dt and fires nothing while time remains", () => {
    const random = vi.spyOn(Math, "random");
    const active: ActiveEvent[] = [];

    expect(stepAutoFire(1, step(active))).toBeCloseTo(0.95);
    expect(active).toEqual([]);
    expect(random).not.toHaveBeenCalled();
  });

  it("fires when the countdown reaches 0 exactly", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const active: ActiveEvent[] = [];

    stepAutoFire(0.05, step(active));

    expect(active).toHaveLength(1);
  });

  it("picks the event, then its seed, voices it, then draws the next wait", () => {
    const { log, voice } = recorder();
    const active: ActiveEvent[] = [];

    const next = stepAutoFire(0, step(active, voice));

    // 0.1 × 8 events → index 0; the seed is 0.2 × 1000; the wait is
    // 0.4 + (1 − rate) × 7 + 0.3 × 2.
    expect(active).toEqual([{ def: EVENTS[0], t0: 3, seed: 200 }]);
    expect(log).toEqual(["random 0.1", "random 0.2", `fire ${EVENTS[0].id}`, "random 0.3"]);
    expect(next).toBeCloseTo(0.4 + 0.5 * 7 + 0.6);
  });

  it("waits 0.4–2.4 s at rate 1 and 7.4–9.4 s at rate 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fast = stepAutoFire(0, { ...step([]), rate: 1 });
    const slow = stepAutoFire(0, { ...step([]), rate: 0 });
    expect(fast).toBeCloseTo(0.4);
    expect(slow).toBeCloseTo(7.4);
  });

  it("can pick the last event and never past it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    const active: ActiveEvent[] = [];

    stepAutoFire(0, step(active));

    expect(active[0]?.def).toBe(EVENTS[EVENTS.length - 1]);
  });
});
