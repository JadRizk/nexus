import { sampleKeys } from "../core/sampleKeys.js";
import type { Key } from "../data/types.js";

/** The size of an envelope chart, and how many segments each curve is drawn with. */
export interface TrackView {
  readonly width: number;
  readonly height: number;
  readonly samples: number;
}

const TRACK_COLORS = [
  "var(--nx-fg-accent)",
  "var(--nx-fg-info)",
  "var(--nx-fg-warning)",
  "var(--nx-fg-critical)",
  "var(--nx-fg-cat-violet)",
  "var(--nx-fg-cat-lime)",
  "var(--nx-fg-default)",
  "#3AC6D4",
] as const;

/** The colour of an event's `index`th track, cycling through eight. */
export function trackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length] ?? TRACK_COLORS[0];
}

/**
 * An SVG path through `keys` from u = 0 to 1. Each track is scaled to its own
 * range so shapes compare across knobs; a flat track sits at mid-height.
 *
 * @throws {TypeError} When `keys` is empty.
 */
export function trackPath(keys: readonly Key[], { width, height, samples }: TrackView): string {
  const values = keys.map(([, value]) => value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  let path = "";
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const level = high === low ? 0.5 : (sampleKeys(keys, u) - low) / (high - low);
    const x = (u * width).toFixed(1);
    const y = (height - 4 - level * (height - 9)).toFixed(1);
    path += `${i ? "L" : "M"}${x},${y}`;
  }
  return path;
}
