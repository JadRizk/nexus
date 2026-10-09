import { EV_BY_ID } from "../data/events/index.js";
import type { EventDef } from "../data/events/types.js";

/** An event on the bus. */
export interface ActiveEvent {
  readonly def: EventDef;
  /** When it started, in seconds on the frame loop's clock. */
  readonly t0: number;
  /** 0–1000; picks this run's chaos dropouts. */
  readonly seed: number;
}

/** Where `fireEvent` puts an event. Push-only, so any ref to an array that takes events fits. */
export interface EventSink {
  readonly current: { push(event: ActiveEvent): unknown };
}

/**
 * Starts the event `id` on an engine's event bus (its `activeRef`), now.
 *
 * @param now The clock, in ms; `t0` is stored in seconds.
 * @param random A source in [0, 1) for the event's seed.
 * @returns The event's definition, or undefined for an unknown id.
 */
export function fireEvent(
  activeRef: EventSink,
  id: string,
  // Wrapped: an unbound `performance.now` throws "Illegal invocation".
  now: () => number = () => performance.now(),
  random: () => number = Math.random,
): EventDef | undefined {
  const def = EV_BY_ID[id];
  if (def) activeRef.current.push({ def, t0: now() / 1000, seed: random() * 1000 });
  return def;
}

/** Gives the graph source a new layout: a fresh seed in `seedRef`, 1–997, never 0. */
export function shuffleSeed(seedRef: { current: number }): void {
  seedRef.current = 1 + Math.floor(Math.random() * 997);
}
