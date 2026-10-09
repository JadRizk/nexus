/* ============================================================================
   NEIGHBOURHOOD

   Moved out of GraphCanvas.tsx's `highlight(idx)`. Breadth-first walk from a
   hovered/selected node over the incidence list, writing per-node depth and
   per-edge tier. Three tiers result: incident edges at 1, edges inside the
   neighbourhood at TIER_NEARBY, everything else at 0.

   `outTier` is dense (Float32Array(m)) rather than the strided `eP2` lane the
   caller ultimately writes into — GraphCanvas scatters it into
   `eP2[e * 4 + A_TIER]` after the call. That costs one O(m) copy per hover
   change, not per frame, and buys an interface that doesn't take a stride and
   an offset.
   ========================================================================== */

/** How many hops out the focused neighbourhood reaches. Beyond this an edge is dimmed as unrelated. */
export const NEARBY_DEPTH = 2;

/**
 * Weight given to an edge inside the focused neighbourhood but not touching
 * the focused node itself. Sits above a resting edge (the neighbourhood you
 * asked for reads as nearer) and well below an incident one.
 */
export const TIER_NEARBY = 0.45;

export interface NeighbourhoodGraph {
  inc: ReadonlyArray<ReadonlyArray<{ e: number; other: number; categoryId: string; out: boolean }>>;
  eA: Int32Array;
  eB: Int32Array;
  /** 1 = hidden, 0 = visible. Hidden nodes are never visited and never earn a depth. */
  hidden: Float32Array;
}

/**
 * @param outDepth length n. -1 = not reached.
 * @param outTier length m. 0 = unrelated, 1 = incident, TIER_NEARBY = nearby.
 */
export function computeNeighbourhood(
  graph: NeighbourhoodGraph,
  idx: number,
  outDepth: Float32Array,
  outTier: Float32Array,
): void {
  const { inc, eA, eB, hidden } = graph;
  const m = outTier.length;

  outDepth.fill(-1);
  outTier.fill(0);
  if (idx < 0) return;

  const q = [idx];
  outDepth[idx] = 0;
  for (let h = 0; h < q.length; h++) {
    const v = q[h]!,
      d = outDepth[v]!;
    if (d >= 3) continue;
    for (const it of inc[v]!) {
      if (outDepth[it.other]! < -0.5 && hidden[it.other] === 0) {
        outDepth[it.other] = d + 1;
        q.push(it.other);
      }
    }
  }
  for (const it of inc[idx]!) outTier[it.e] = 1;
  // The BFS above already walks outDepth to 3; this spends what it computes.
  // Without it hover is a spotlight rather than a neighbourhood you can read.
  //
  // `<= NEARBY_DEPTH`, not `=== NEARBY_DEPTH`: an edge joining two *immediate*
  // neighbours has depth 1 at both ends, and testing for equality dropped it
  // to the unrelated tier — the single most interesting kind of link in a
  // hovered neighbourhood, dimmed.
  for (let e = 0; e < m; e++) {
    if (outTier[e] === 1) continue;
    const da = outDepth[eA[e]!]!,
      db = outDepth[eB[e]!]!;
    if (da >= 0 && db >= 0 && Math.max(da, db) <= NEARBY_DEPTH) {
      outTier[e] = TIER_NEARBY;
    }
  }
}
