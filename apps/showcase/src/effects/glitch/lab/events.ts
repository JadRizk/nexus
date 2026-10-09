import type { RunningEvent } from "../core/resolveEvents.js";
import { EV_BY_ID } from "../data/events/index.js";

/** Whether any running event has a track on the effect `effectId`. */
export function isEffectHot(running: readonly RunningEvent[], effectId: string): boolean {
  return running.some(
    (event) => EV_BY_ID[event.id]?.tracks.some((track) => track.fx === effectId) ?? false,
  );
}

/** The index `random` (0–1) picks out of `count` events. */
export function randomEventIndex(random: number, count: number): number {
  return (random * count) | 0;
}
