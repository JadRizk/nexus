import type { Key } from "../data/types.js";

/**
 * Samples a keyframe track at `u`, the fraction (0–1) of the way through its
 * event. Before the first key it reads the first key's value; past the last,
 * the last key's value. A "step" key holds the previous value up to and
 * including its own `at`, then jumps.
 *
 * @throws {TypeError} When `keys` is empty.
 */
export function sampleKeys(keys: readonly Key[], u: number): number {
  const first = keys[0];
  if (first === undefined) throw new TypeError("sampleKeys needs at least one key");
  if (u <= first[0]) return first[1];
  let previous = first;
  for (const next of keys.slice(1)) {
    if (u <= next[0]) {
      if (next[2] === "step") return previous[1];
      const t = (u - previous[0]) / Math.max(1e-6, next[0] - previous[0]);
      return previous[1] + (next[1] - previous[1]) * t;
    }
    previous = next;
  }
  return previous[1];
}
