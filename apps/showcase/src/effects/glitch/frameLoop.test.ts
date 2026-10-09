import { afterEach, describe, expect, it, vi } from "vitest";
import type { QueuedEvent } from "./core/bus.js";
import { configFor } from "./core/config.js";
import type { ActiveEvent } from "./core/events.js";
import { fireEvent } from "./core/events.js";
import type { RunningEvent } from "./core/resolveEvents.js";
import { EV_BY_ID } from "./data/events/index.js";
import type { EngineRefs, FrameLoopDeps } from "./frameLoop.js";
import { createFrameLoop } from "./frameLoop.js";
import type { Frame } from "./gl/renderer.js";

afterEach(() => {
  vi.restoreAllMocks();
});

interface Harness {
  readonly frame: (now: number) => void;
  readonly draws: Frame[];
  readonly requestFrame: ReturnType<typeof vi.fn>;
  readonly onLive: ReturnType<typeof vi.fn>;
  readonly onFps: ReturnType<typeof vi.fn>;
  readonly refs: MutableRefs;
}

/** The loop's refs, writable, as a component holds them. */
type MutableRefs = {
  readonly [Key in keyof EngineRefs]-?: { current: Required<EngineRefs>[Key]["current"] };
};

/** A loop over a fake renderer that records each frame, with rAF stubbed out. */
function harness(options: Partial<Pick<FrameLoopDeps, "maxFps" | "startedAt">> = {}): Harness {
  const draws: Frame[] = [];
  const requestFrame = vi.fn();
  const onLive = vi.fn();
  const onFps = vi.fn();
  const refs = {
    cfgRef: { current: configFor("CLEAN") },
    srcRef: { current: 1 },
    activeRef: { current: [] as ActiveEvent[] },
    queueRef: { current: [] as QueuedEvent[] },
    autoRef: { current: false },
    rateRef: { current: 0.5 },
    audioRef: { current: null },
    stillRef: { current: false as boolean | null },
    seedRef: { current: 7 },
  };
  const frame = createFrameLoop({
    refs,
    renderer: { draw: (drawn) => draws.push(drawn) },
    requestFrame,
    onLive: (running: RunningEvent[]) => onLive(running),
    onFps: (fps: number) => onFps(fps),
    maxFps: options.maxFps ?? 0,
    startedAt: options.startedAt ?? 0,
  });
  return { frame, draws, requestFrame, onLive, onFps, refs };
}

describe("frameLoop: looping", () => {
  it("schedules the next frame, then draws at the clock in seconds", () => {
    const loop = harness();

    loop.frame(1000);

    expect(loop.requestFrame).toHaveBeenCalledWith(loop.frame);
    expect(loop.draws).toHaveLength(1);
    expect(loop.draws[0]).toMatchObject({ time: 1, source: 1, seed: 7 });
  });

  it("draws the CLEAN preset's one effect, the CRT", () => {
    const loop = harness();
    loop.frame(16);
    expect(loop.draws[0]?.passes.map((pass) => pass.effect.id)).toEqual(["crt"]);
  });

  it("reads a missing seed as 0", () => {
    const loop = harness();
    loop.refs.seedRef.current = null;
    loop.frame(16);
    expect(loop.draws[0]?.seed).toBe(0);
  });
});

describe("frameLoop: still mode", () => {
  it("draws once at a clock of 2.5 s and schedules nothing", () => {
    const loop = harness();
    loop.refs.stillRef.current = true;

    loop.frame(98_765);

    expect(loop.requestFrame).not.toHaveBeenCalled();
    expect(loop.draws.map((drawn) => drawn.time)).toEqual([2.5]);
  });

  it("ignores the frame cap, so every invalidate draws", () => {
    const loop = harness({ maxFps: 30 });
    loop.refs.stillRef.current = true;

    loop.frame(100);
    loop.frame(101);

    expect(loop.draws).toHaveLength(2);
  });

  it("starts queued events at 2.5 s too", () => {
    const loop = harness();
    loop.refs.stillRef.current = true;
    loop.refs.queueRef.current.push({ id: "crash", at: 2 });

    loop.frame(10_000);

    expect(loop.refs.activeRef.current).toMatchObject([{ def: EV_BY_ID.crash, t0: 2.5 }]);
  });
});

describe("frameLoop: the frame cap", () => {
  it("skips display frames inside the gap but keeps scheduling", () => {
    // 30 fps: a gap of 1000 / 30 − 1 ≈ 32.3 ms.
    const loop = harness({ maxFps: 30 });

    loop.frame(1000);
    loop.frame(1016);
    loop.frame(1032);
    loop.frame(1033);

    expect(loop.requestFrame).toHaveBeenCalledTimes(4);
    expect(loop.draws.map((drawn) => drawn.time)).toEqual([1, 1.033]);
  });

  it("draws every frame at maxFps 0", () => {
    const loop = harness();
    for (const now of [0, 1, 2, 3]) loop.frame(now);
    expect(loop.draws).toHaveLength(4);
  });
});

describe("frameLoop: the throttles", () => {
  it("reports the running events once over 0.05 s of frame time, then starts over", () => {
    // Each frame's dt is capped at 0.05 s, so it takes two to pass 0.05.
    const loop = harness();
    fireEvent(loop.refs.activeRef, "crash", () => 0);

    loop.frame(50);
    expect(loop.onLive).not.toHaveBeenCalled();
    loop.frame(100);
    expect(loop.onLive).toHaveBeenCalledTimes(1);
    expect(loop.onLive.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: "crash", label: "HEAD CRASH" }),
    ]);
    loop.frame(150);
    expect(loop.onLive).toHaveBeenCalledTimes(1);
    loop.frame(200);
    expect(loop.onLive).toHaveBeenCalledTimes(2);
  });

  it("measures dt from the clock at start, capped at 0.05 s", () => {
    const loop = harness({ startedAt: 990 });
    loop.frame(1000);
    loop.frame(1060);
    // 0.01 + 0.05 is over 0.05: the second frame reports.
    expect(loop.onLive).toHaveBeenCalledTimes(1);
  });

  it("reports the mean frame rate once over 0.5 s of frame time, rounded", () => {
    const loop = harness();
    // 11 frames of 0.05 s (20 fps) pass 0.5 s on the eleventh.
    for (let k = 1; k <= 10; k++) loop.frame(k * 50);
    expect(loop.onFps).not.toHaveBeenCalled();
    loop.frame(550);
    expect(loop.onFps).toHaveBeenCalledExactlyOnceWith(20);
  });

  it("averages the per-frame rates, and starts over after each report", () => {
    const loop = harness();
    // Ten frames at 0.05 s (20 fps), then one at 0.025 s (40 fps): over 0.5 s.
    for (let k = 1; k <= 10; k++) loop.frame(k * 50);
    loop.frame(525);
    expect(loop.onFps).toHaveBeenLastCalledWith(Math.round((10 * 20 + 40) / 11));
    for (let k = 1; k <= 11; k++) loop.frame(525 + k * 50);
    expect(loop.onFps).toHaveBeenCalledTimes(2);
    expect(loop.onFps).toHaveBeenLastCalledWith(20);
  });
});

describe("frameLoop: auto-fire", () => {
  it("fires nothing while autoRef is off", () => {
    const loop = harness();
    for (let k = 1; k <= 100; k++) loop.frame(k * 50);
    expect(loop.refs.activeRef.current).toEqual([]);
  });

  it("fires its first event after 2 s of frame time", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const loop = harness();
    loop.refs.autoRef.current = true;

    for (let k = 1; k <= 39; k++) loop.frame(k * 50);
    expect(loop.refs.activeRef.current).toHaveLength(0);
    loop.frame(40 * 50);
    expect(loop.refs.activeRef.current).toHaveLength(1);
  });
});

describe("frameLoop: the dt cap", () => {
  it("caps a frame gap over 60 ms at 0.05 s, so one late frame does not report", () => {
    // Uncapped, 0.06 s would pass the 0.05 s report interval on its own.
    const loop = harness();
    fireEvent(loop.refs.activeRef, "crash", () => 0);

    loop.frame(60);

    expect(loop.onLive).not.toHaveBeenCalled();
  });
});

describe("frameLoop: auto-fire rate", () => {
  /**
   * Runs `frames` frames of 0.05 s with auto-fire on at `rate`; returns how
   * many events started. Counted at the push, since a short event is pruned
   * from the bus once it ends.
   */
  function autoFired(rate: number, frames: number): number {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const loop = harness();
    loop.refs.autoRef.current = true;
    loop.refs.rateRef.current = rate;
    let started = 0;
    const active = loop.refs.activeRef.current;
    const push = active.push.bind(active);
    active.push = (...events) => {
      started += events.length;
      return push(...events);
    };
    for (let k = 1; k <= frames; k++) loop.frame(k * 50);
    return started;
  }

  it("reads rateRef: at 1 the next fault follows 0.4 s after the first", () => {
    // The first fires at 2 s (frame 40); the next waits 0.4 + (1 − 1) × 7 + 0 s.
    expect(autoFired(1, 46)).toBe(1);
    expect(autoFired(1, 50)).toBe(2);
  });

  it("reads rateRef: at 0 the next fault waits 7.4 s", () => {
    expect(autoFired(0, 50)).toBe(1);
  });
});

describe("frameLoop: the voice", () => {
  /** A voice that records each id with how many events were active as it fired. */
  function recordingVoice(active: { current: ActiveEvent[] }) {
    const calls: [string, number][] = [];
    return { calls, voice: { fire: (id: string) => calls.push([id, active.current.length]) } };
  }

  it("voices a queued event through audioRef, after it is pushed", () => {
    const loop = harness();
    const { calls, voice } = recordingVoice(loop.refs.activeRef);
    loop.refs.audioRef.current = voice;
    loop.refs.queueRef.current.push({ id: "crash", at: 0 });

    loop.frame(16);

    expect(calls).toEqual([["crash", 1]]);
  });

  it("voices an auto-fired event through audioRef, after it is pushed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const loop = harness();
    const { calls, voice } = recordingVoice(loop.refs.activeRef);
    loop.refs.audioRef.current = voice;
    loop.refs.autoRef.current = true;

    for (let k = 1; k <= 40; k++) loop.frame(k * 50);

    const first = loop.refs.activeRef.current[0];
    expect(calls).toEqual([[first?.def.id, 1]]);
  });
});
