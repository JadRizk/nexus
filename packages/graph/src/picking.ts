/* ============================================================================
   PICKING

   Moved out of GraphCanvas.tsx's `pickNode(wx, wy)`. Nearest node whose
   distance is inside `radius + grab`, where `grab` is a screen-space grab
   margin that shrinks as you zoom in and stops shrinking at a 5-unit floor.

   The margin is also what keeps every node a usable pointer target: `12 /
   zoom` world units is 12 screen pixels, and past zoom 2.4 the 5-unit floor
   is already more than that, so the hit circle never has less than a 12px
   radius on screen — a 24px target at any zoom (WCAG 2.5.8). A test pins it.
   ========================================================================== */

/** Screen-pixel grab margin while zoomed out; the world-unit floor takes over past zoom 2.4. */
export const PICK_GRAB_PX = 12;
/** World-unit floor on the grab margin. */
export const PICK_GRAB_MIN = 5;

/**
 * @param x world-space x.
 * @param y world-space y.
 * @param count number of nodes.
 * @param pos length count*2, interleaved x,y per node.
 * @param radii length count, per-node radius.
 * @param hidden length count. 1 = hidden, 0 = visible. A hidden node is never picked.
 * @param zoom current camera zoom.
 * @returns the picked node's index, or -1.
 */
export function pickNode(
  x: number,
  y: number,
  count: number,
  pos: Float32Array,
  radii: Float32Array,
  hidden: Float32Array,
  zoom: number,
): number {
  let best = -1,
    bd = Infinity;
  const grab = Math.max(PICK_GRAB_MIN, PICK_GRAB_PX / zoom);
  for (let i = 0; i < count; i++) {
    if (hidden[i] !== 0) continue;
    const dx = pos[i * 2]! - x,
      dy = pos[i * 2 + 1]! - y;
    const d2 = dx * dx + dy * dy,
      r = radii[i]! + grab;
    if (d2 < r * r && d2 < bd) {
      bd = d2;
      best = i;
    }
  }
  return best;
}
