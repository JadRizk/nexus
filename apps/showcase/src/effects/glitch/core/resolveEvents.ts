import type { EffectId } from "../data/effects/index.js";
import type { TrackMode } from "../data/types.js";
import { chaosEnv } from "./chaosEnv.js";
import type { ActiveEvent } from "./events.js";
import { sampleKeys } from "./sampleKeys.js";

/** Knob values the running events lay over the resting config, by effect id. */
export type Overrides = Partial<Record<EffectId, Record<string, number>>>;

/** An event mid-run, for the live readout. */
export interface RunningEvent {
  readonly id: string;
  readonly label: string;
  /** 0–1: how far through the event. */
  readonly u: number;
}

export interface Resolved {
  readonly overrides: Overrides;
  /** Newest first. */
  readonly running: RunningEvent[];
}

function combine(mode: TrackMode, current: number | undefined, value: number): number {
  switch (mode) {
    case "max":
      return Math.max(current ?? 0, value);
    case "add":
      return (current ?? 0) + value;
    case "set":
      return value;
    default: {
      const unhandled: never = mode;
      throw new TypeError(`Unknown track mode: ${String(unhandled)}`);
    }
  }
}

function applyTracks(overrides: Overrides, event: ActiveEvent, u: number): void {
  const envelope = chaosEnv(u, event.def.chaos, event.seed);
  for (const track of event.def.tracks) {
    const raw = sampleKeys(track.keys, u);
    const value = track.param === "amt" ? raw * envelope : raw;
    const knobs = (overrides[track.fx] ||= {});
    knobs[track.param] = combine(track.mode, knobs[track.param], value);
  }
}

/**
 * Resolves the active events at `time` (seconds, the clock their `t0` is on)
 * into one override layer. Events stack per knob by their track's mode: `max`
 * takes the strongest (from a floor of 0), `add` accumulates, and of several
 * `set`s the oldest event's wins. Each event's `amt` tracks are scaled by its
 * chaos envelope.
 *
 * Mutates `active`: an event at or past its end (`u >= 1`) is removed. One
 * not yet started (`u < 0`) is kept and skipped.
 */
export function resolveEvents(active: ActiveEvent[], time: number): Resolved {
  const overrides: Overrides = {};
  const running: RunningEvent[] = [];
  // Backwards, so splicing doesn't skip the next event; it is also why the
  // oldest `set` is written last and wins.
  for (let i = active.length - 1; i >= 0; i--) {
    const event = active[i];
    // The bus is a dense array, so this only narrows the type, without a `!`.
    if (event === undefined) continue;
    const u = (time - event.t0) / event.def.dur;
    if (u >= 1) {
      active.splice(i, 1);
      continue;
    }
    if (u < 0) continue;
    running.push({ id: event.def.id, label: event.def.label, u });
    applyTracks(overrides, event, u);
  }
  return { overrides, running };
}
