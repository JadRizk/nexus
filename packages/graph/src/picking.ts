/** Screen-pixel grab margin: keeps every hit target ≥ 24px across at any zoom (WCAG 2.5.8). */
export const PICK_GRAB_PX = 12;
/** World-unit floor on the grab margin; takes over past zoom 2.4. */
export const PICK_GRAB_MIN = 5;

/** Index of the nearest visible node whose radius plus grab margin covers world (x, y), or -1. `positions` is interleaved x,y. */
export function pickNode(
  x: number,
  y: number,
  count: number,
  positions: Float32Array,
  radii: Float32Array,
  hidden: Float32Array,
  zoom: number,
): number {
  let bestIndex = -1,
    bestDistanceSq = Infinity;
  const grab = Math.max(PICK_GRAB_MIN, PICK_GRAB_PX / zoom);
  for (let i = 0; i < count; i++) {
    if (hidden[i] !== 0) continue;
    const dx = positions[i * 2]! - x,
      dy = positions[i * 2 + 1]! - y;
    const distanceSq = dx * dx + dy * dy,
      reach = radii[i]! + grab;
    if (distanceSq < reach * reach && distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = i;
    }
  }
  return bestIndex;
}
