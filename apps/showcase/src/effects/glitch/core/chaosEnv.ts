import { hashf } from "./hash.js";

/**
 * The chaos term: a multiplier on an event's envelope at `u` (0–1 through the
 * event), at most 1 and, for `chaos` up to 1, at least 0. `chaos` (0–1) sets
 * how deep a dip cuts; 0 or less returns 1.
 *
 * Quantised to ~24 Hz so it stutters like frames dropping rather than
 * shimmering like noise, and it only ever *reduces* the envelope — a fault
 * that randomly gets stronger than its own peak feels wrong.
 */
export function chaosEnv(u: number, chaos: number, seed: number): number {
  if (chaos <= 0) return 1;
  const frame = Math.floor(u * 24);
  const noise = hashf(frame * 7.13 + seed * 31.7);
  const dip = noise > 0.72 ? 1 - chaos * (0.35 + 0.65 * hashf(frame * 3.1 + seed)) : 1;
  return dip;
}
