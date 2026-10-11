import { EV_BY_ID, EVENTS } from "../data/events/index.js";
import type { ActiveEvent } from "./events.js";

/** An event waiting on the bus's queue, such as the next step of a chain. */
export interface QueuedEvent {
  readonly id: string;
  /** When it starts, in seconds on the frame loop's clock. */
  readonly at: number;
}

/** Whatever voices an event as it starts; the engine's audio. */
export interface EventVoice {
  fire(id: string): unknown;
}

/**
 * Moves every queued event that is due at `time` (seconds) onto `active`,
 * stamped with `time` and a fresh seed, and voices it. Due entries with an
 * unknown id are dropped silently.
 *
 * Walks the queue from the end, so entries due on the same frame start in
 * reverse queue order. Calls `Math.random` once per started event.
 */
export function drainQueue(
  queue: QueuedEvent[],
  active: ActiveEvent[],
  time: number,
  voice: EventVoice | null | undefined,
): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    const queued = queue[i];
    // The queue is a dense array, so this only narrows the type.
    if (queued === undefined || queued.at > time) continue;
    queue.splice(i, 1);
    const def = EV_BY_ID[queued.id];
    if (def) {
      active.push({ def, t0: time, seed: Math.random() * 1000 });
      voice?.fire(queued.id);
    }
  }
}

/** One frame of auto-fire, as `stepAutoFire` reads it. */
export interface AutoFireStep {
  readonly active: ActiveEvent[];
  /** The frame loop's clock, in seconds. */
  readonly time: number;
  /** Seconds since the last frame. */
  readonly dt: number;
  /** 0–1: 0 waits 7.4–9.4 s between faults, 1 waits 0.4–2.4 s. */
  readonly rate: number;
  readonly voice: EventVoice | null | undefined;
}

/**
 * Counts `countdown` (seconds to the next fault) down by `dt`. When it runs
 * out, starts a random event and voices it.
 *
 * Calls `Math.random` three times when it fires: the event, its seed, then
 * the next wait.
 *
 * @returns The countdown for the next frame, in seconds.
 */
export function stepAutoFire(countdown: number, step: AutoFireStep): number {
  const remaining = countdown - step.dt;
  return remaining <= 0 ? fireRandom(step) : remaining;
}

function fireRandom(step: AutoFireStep): number {
  const def = EVENTS[(Math.random() * EVENTS.length) | 0];
  // The index is always in range; this only narrows the type.
  if (def === undefined) return 0;
  step.active.push({ def, t0: step.time, seed: Math.random() * 1000 });
  step.voice?.fire(def.id);
  return 0.4 + (1 - step.rate) * 7 + Math.random() * 2;
}
