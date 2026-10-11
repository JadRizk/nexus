import type { Config } from "./core/config.js";
import { drainQueue, stepAutoFire } from "./core/bus.js";
import type { EventVoice, QueuedEvent } from "./core/bus.js";
import type { ActiveEvent } from "./core/events.js";
import { resolveEvents } from "./core/resolveEvents.js";
import type { RunningEvent } from "./core/resolveEvents.js";
import { EFFECTS } from "./data/effects/index.js";
import { planPasses } from "./gl/passes.js";
import type { Renderer } from "./gl/renderer.js";

/**
 * Everything the loop reads, as refs, so it is current as of the last commit
 * without re-arming the loop.
 */
export interface EngineRefs {
  /** The resting effect config, as Glitch Lab builds it. */
  readonly cfgRef: { readonly current: Config };
  /** The source picture: 0 graph, 1 bars, 2 console. */
  readonly srcRef: { readonly current: number };
  /** The event bus: events running now. */
  readonly activeRef: { readonly current: ActiveEvent[] };
  /** The event bus: events waiting to start. */
  readonly queueRef: { readonly current: QueuedEvent[] };
  /** Truthy: fire random events by themselves. */
  readonly autoRef?: { readonly current: boolean | null };
  /** 0–1: how often auto-fire fires. */
  readonly rateRef?: { readonly current: number | null };
  readonly audioRef?: { readonly current: EventVoice | null };
  /** Truthy: draw one frame per invalidate instead of looping, for reduced motion. */
  readonly stillRef?: { readonly current: boolean | null };
  /** The graph source's layout seed; see `shuffleSeed`. */
  readonly seedRef?: { readonly current: number | null };
}

export interface FrameLoopDeps {
  readonly refs: Required<EngineRefs>;
  readonly renderer: Pick<Renderer, "draw">;
  /** Schedules `frame` for the next display frame: `requestAnimationFrame`, in the browser. */
  readonly requestFrame: (frame: (now: number) => void) => void;
  /** The running events, at most every 0.05 s of frame time. */
  readonly onLive: (running: RunningEvent[]) => void;
  /** Frames per second, averaged over each 0.5 s of frame time. */
  readonly onFps: (fps: number) => void;
  /** The most frames per second to draw; 0 draws every display frame. */
  readonly maxFps: number;
  /** The clock when the loop starts, in ms; the first frame's `dt` is measured from it. */
  readonly startedAt: number;
}

// The clock a still frame is drawn at, so it is the same frame every time.
const STILL_TIME = 2.5;
// Seconds. A frame after a stall steps the events by no more than this.
const MAX_DT = 0.05;
const LIVE_INTERVAL = 0.05;
const FPS_INTERVAL = 0.5;
const FIRST_AUTO_FIRE = 2;

interface FpsMeter {
  rateSum: number;
  frames: number;
  elapsed: number;
}

/** Adds a frame of `dt` seconds; once over the interval, returns the mean rate and starts over. */
function meterFps(meter: FpsMeter, dt: number): number | undefined {
  meter.rateSum += 1 / Math.max(dt, 1e-4);
  meter.frames++;
  meter.elapsed += dt;
  if (meter.elapsed > FPS_INTERVAL) {
    const fps = Math.round(meter.rateSum / meter.frames);
    meter.rateSum = 0;
    meter.frames = 0;
    meter.elapsed = 0;
    return fps;
  }
  return undefined;
}

/**
 * The engine's per-frame step, to pass to `requestFrame` with the clock in ms.
 * Each frame it starts due and auto-fired events, resolves the bus, and draws.
 *
 * - Looping, it schedules the next frame first, then skips this one if it
 *   lands within `maxFps`'s gap of the last one drawn.
 * - Still (`stillRef` truthy), it draws once at a fixed clock of 2.5 s and
 *   schedules nothing; the caller draws again when something changes.
 */
export function createFrameLoop(deps: FrameLoopDeps): (now: number) => void {
  const { refs, renderer, requestFrame } = deps;
  const minGap = deps.maxFps > 0 ? 1000 / deps.maxFps - 1 : 0;
  let lastDraw = -Infinity;
  let lastFrame = deps.startedAt;
  let nextAutoFire = FIRST_AUTO_FIRE;
  let liveElapsed = 0;
  const fpsMeter: FpsMeter = { rateSum: 0, frames: 0, elapsed: 0 };

  const frame = (now: number): void => {
    const isStill = !!refs.stillRef.current;
    if (!isStill) requestFrame(frame);
    if (!isStill && now - lastDraw < minGap) return;
    lastDraw = now;
    const dt = Math.min(MAX_DT, (now - lastFrame) / 1000);
    lastFrame = now;
    const time = isStill ? STILL_TIME : now / 1000;
    const config = refs.cfgRef.current;
    const active = refs.activeRef.current;
    const voice = refs.audioRef.current;

    drainQueue(refs.queueRef.current, active, time, voice);
    if (refs.autoRef.current) {
      const rate = refs.rateRef.current ?? 0;
      nextAutoFire = stepAutoFire(nextAutoFire, { active, time, dt, rate, voice });
    }
    const { overrides, running } = resolveEvents(active, time);
    liveElapsed += dt;
    if (liveElapsed > LIVE_INTERVAL) {
      liveElapsed = 0;
      deps.onLive(running);
    }

    renderer.draw({
      time,
      source: refs.srcRef.current,
      seed: refs.seedRef.current ?? 0,
      passes: planPasses(EFFECTS, config, overrides),
    });
    const fps = meterFps(fpsMeter, dt);
    if (fps !== undefined) deps.onFps(fps);
  };
  return frame;
}
