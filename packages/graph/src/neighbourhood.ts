/** Hops the focused neighbourhood reaches; edges beyond it dim as unrelated. */
export const NEARBY_DEPTH = 2;

/** Tier of an edge inside the neighbourhood but not incident: above a resting edge (0), below an incident one (1). */
export const TIER_NEARBY = 0.45;

export interface NeighbourhoodGraph {
  /** Only `edge` and `other` are read, so the navigator's ranked lists serve as they are. */
  inc: ReadonlyArray<ReadonlyArray<{ edge: number; other: number }>>;
  eA: Int32Array;
  eB: Int32Array;
  /** 1 = hidden, 0 = visible. Hidden nodes never earn a depth. */
  hidden: Float32Array;
  /** The walk never crosses a hidden edge. Omitted, every edge counts. */
  edgeHidden?: (edge: number) => boolean;
}

/**
 * @param outDepth length n. -1 = not reached.
 * @param outTier length m, dense; the caller scatters it once per hover. 0 = unrelated, 1 = incident, TIER_NEARBY = nearby.
 */
export function computeNeighbourhood(
  graph: NeighbourhoodGraph,
  index: number,
  outDepth: Float32Array,
  outTier: Float32Array,
): void {
  const { inc, eA, eB, hidden, edgeHidden } = graph;
  const edgeCount = outTier.length;

  outDepth.fill(-1);
  outTier.fill(0);
  if (index < 0) return;

  const queue = [index];
  outDepth[index] = 0;
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head],
      depth = outDepth[node];
    if (depth >= 3) continue;
    for (const connection of inc[node]) {
      if (
        outDepth[connection.other] < -0.5 &&
        hidden[connection.other] === 0 &&
        !edgeHidden?.(connection.edge)
      ) {
        outDepth[connection.other] = depth + 1;
        queue.push(connection.other);
      }
    }
  }
  for (const connection of inc[index]) outTier[connection.edge] = 1;
  // `<=`, not `===`: an edge between two immediate neighbours has depth 1 at both ends.
  for (let e = 0; e < edgeCount; e++) {
    if (outTier[e] === 1) continue;
    const depthA = outDepth[eA[e]],
      depthB = outDepth[eB[e]];
    if (depthA >= 0 && depthB >= 0 && Math.max(depthA, depthB) <= NEARBY_DEPTH) {
      outTier[e] = TIER_NEARBY;
    }
  }
}

/** The node and everything one edge away, as both the canvas and `describeGraph` show it; null when `isolated` is -1. */
export function isolationSet(isolated: number, eA: Int32Array, eB: Int32Array): Set<number> | null {
  if (isolated < 0) return null;
  const keep = new Set([isolated]);
  for (let e = 0; e < eA.length; e++) {
    if (eA[e] === isolated) keep.add(eB[e]);
    if (eB[e] === isolated) keep.add(eA[e]);
  }
  return keep;
}
