/* ============================================================================
   PHYSICS

   Physics solver working with generic Float32Array-based graph structures.
   Takes already-resolved per-node charge/mass and per-edge dist/strength,
   computing graph-structural properties (e.g. degree) from the edge list.
   ========================================================================== */

export interface PhysicsNode {
  charge: number;
  mass: number;
}

export interface PhysicsEdge {
  /** Node index, not id — the caller resolves ids to dense indices. */
  a: number;
  b: number;
  dist: number;
  strength: number;
}

export interface PhysicsGraph {
  nodes: readonly PhysicsNode[];
  edges: readonly PhysicsEdge[];
}

export interface PhysicsParams {
  repulsion: number;
  linkDistance: number;
  gravity: number;
  damping: number;
  cursorForce: number;
}

export interface Physics {
  /** Live position buffer, `[x0, y0, x1, y1, ...]`. Mutated in place by step(). */
  pos: Float32Array;
  /** Advances one fixed timestep. Returns false when settled and idle (nothing to redraw). */
  step(): boolean;
  isSettled(): boolean;
  /** Partial physics params, plus an optional `settle` alpha-target (0 = come to rest, >0 = keep simmering). */
  setParams(p: Partial<PhysicsParams> & { settle?: number }): void;
  reheat(v: number): void;
  /** i < 0 releases the pin. */
  pin(i: number, x: number, y: number): void;
  cursor(x: number, y: number, on: boolean): void;
}

/** Edge count touching each node index. Shared by createPhysics (edge stiffness) and GraphCanvas (node radius, orphan-state derivation) so there's exactly one place this gets computed. */
export function computeDegree(edges: ReadonlyArray<{ a: number; b: number }>, nodeCount: number): Uint16Array {
  const degree = new Uint16Array(nodeCount);
  for (const e of edges) { degree[e.a]!++; degree[e.b]!++; }
  return degree;
}

export function createPhysics(graph: PhysicsGraph): Physics {
  const n = graph.nodes.length, m = graph.edges.length;
  const degree = computeDegree(graph.edges, n);

  const pos = new Float32Array(n * 2), vel = new Float32Array(n * 2);
  const fx = new Float32Array(n), fy = new Float32Array(n);
  const charge = new Float32Array(n), mass = new Float32Array(n);
  const eA = new Uint32Array(m), eB = new Uint32Array(m);
  const eRest = new Float32Array(m), eK = new Float32Array(m);
  const eWA = new Float32Array(m), eWB = new Float32Array(m);

  for (let i = 0; i < n; i++) {
    const node = graph.nodes[i]!;
    charge[i] = node.charge; mass[i] = node.mass;
    const a = (i / n) * Math.PI * 10, r = 30 + Math.sqrt(i) * 9;
    pos[i * 2] = Math.cos(a) * r + (Math.random() - 0.5) * 20;
    pos[i * 2 + 1] = Math.sin(a) * r + (Math.random() - 0.5) * 20;
  }
  // Stiffness normalised by degree, or a 35-link hub diverges under Euler.
  for (let e = 0; e < m; e++) {
    const edge = graph.edges[e]!, a = edge.a, b = edge.b;
    const da = Math.max(1, degree[a]!), db = Math.max(1, degree[b]!);
    eA[e] = a; eB[e] = b; eRest[e] = edge.dist;
    eK[e] = edge.strength / Math.min(da, db);
    eWA[e] = db / (da + db); eWB[e] = da / (da + db);
  }

  let alpha = 1, alphaTarget = 0, settled = false;
  const A_MIN = 0.0015, A_DECAY = 0.0208;
  const P: PhysicsParams = { repulsion: 900, linkDistance: 78, gravity: 0.028, damping: 0.62, cursorForce: 0 };
  let pinIdx = -1, pinX = 0, pinY = 0, curX = 0, curY = 0, curOn = false;

  function step(): boolean {
    if (settled && pinIdx < 0 && !(curOn && P.cursorForce !== 0)) return false;
    fx.fill(0); fy.fill(0);
    const k = P.repulsion * alpha;
    for (let i = 0; i < n; i++) {
      const xi = pos[i * 2]!, yi = pos[i * 2 + 1]!, ci = charge[i]!;
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j * 2]! - xi, dy = pos[j * 2 + 1]! - yi;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-3) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = dx * dx + dy * dy + 1e-3; }
        const f = (k * ci * charge[j]!) / (d2 * Math.sqrt(d2));
        const ax = dx * f, ay = dy * f;
        fx[i] -= ax; fy[i] -= ay; fx[j]! += ax; fy[j]! += ay;
      }
    }
    for (let e = 0; e < m; e++) {
      const a = eA[e]!, b = eB[e]!;
      let dx = pos[b * 2]! - pos[a * 2]!, dy = pos[b * 2 + 1]! - pos[a * 2 + 1]!;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-4) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = 1e-2; }
      const f = ((d - eRest[e]! * P.linkDistance) / d) * eK[e]! * alpha;
      fx[a] += dx * f * eWA[e]!; fy[a] += dy * f * eWA[e]!;
      fx[b]! -= dx * f * eWB[e]!; fy[b]! -= dy * f * eWB[e]!;
    }
    const g = P.gravity * alpha, damp = P.damping, cf = P.cursorForce;
    let maxS = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 2]!, y = pos[i * 2 + 1]!;
      fx[i]! -= x * g; fy[i]! -= y * g;
      if (curOn && cf !== 0) {
        const dx = x - curX, dy = y - curY, d2 = dx * dx + dy * dy + 60;
        const inv = (cf * 14000) / (d2 * Math.sqrt(d2));
        fx[i]! += dx * inv; fy[i]! += dy * inv;
      }
      const im = 1 / mass[i]!;
      let vx = (vel[i * 2]! + fx[i]! * im) * damp, vy = (vel[i * 2 + 1]! + fy[i]! * im) * damp;
      const s2 = vx * vx + vy * vy;
      if (s2 > 400) { const s = 20 / Math.sqrt(s2); vx *= s; vy *= s; }
      if (s2 > maxS) maxS = s2;
      vel[i * 2] = vx; vel[i * 2 + 1] = vy;
      pos[i * 2] = x + vx; pos[i * 2 + 1] = y + vy;
    }
    if (pinIdx >= 0) {
      pos[pinIdx * 2] = pinX; pos[pinIdx * 2 + 1] = pinY;
      vel[pinIdx * 2] = 0; vel[pinIdx * 2 + 1] = 0;
    }
    alpha += (alphaTarget - alpha) * A_DECAY;
    if ((alpha < A_MIN || (Math.sqrt(maxS) < 0.004 && alpha < 0.06)) && alphaTarget < A_MIN) {
      settled = true; vel.fill(0);
    }
    return true;
  }
  return {
    pos, step,
    isSettled: () => settled,
    setParams(p) {
      Object.assign(P, p);
      if ("settle" in p) alphaTarget = p.settle ?? 0;
      settled = false; alpha = Math.max(alpha, 0.28);
    },
    reheat(v) { settled = false; alpha = Math.max(alpha, v); },
    pin(i, x, y) { pinIdx = i; pinX = x; pinY = y; if (i >= 0) { settled = false; alpha = Math.max(alpha, 0.35); } },
    cursor(x, y, on) { curX = x; curY = y; curOn = on; },
  };
}
