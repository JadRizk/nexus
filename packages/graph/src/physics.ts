/* ============================================================================
   PHYSICS

   The stepping numerics are byte-for-byte identical to the prototype this
   was extracted from while `sectorForce` and `radiusForce` stay 0 (a test
   pins that). The one other change is the input shape: the
   prototype's `createPhysics(G)` read `NODE_TYPES[G.nodes[i].type]` and
   `LINK_TYPES[G.edges[e].type]` directly from module-global lookup tables,
   which made it silently coupled to one specific taxonomy despite already
   being framework-agnostic (Float32Array-based) everywhere else. This
   version takes already-resolved per-node charge/mass and per-edge
   dist/strength instead, and computes `degree` itself from the edge list
   (previously computed by the caller and passed in) rather than requiring
   the consumer to precompute a graph-structural property the physics
   already needs to derive for itself.
   ========================================================================== */

import { mulberry32 } from "./random.js";

export interface PhysicsNode {
  charge: number;
  mass: number;
  /** Radians about the origin: a tangential bias toward this angle; radius is untouched. */
  sectorAngle?: number;
  /** World units: a radial spring toward this distance from the origin, replacing gravity for the node. */
  radiusTarget?: number;
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
  /** Strength of the sectorAngle bias; 0 disables it. */
  sectorForce: number;
  /** Strength of the radiusTarget spring; 0 disables it and those nodes fall back to gravity. */
  radiusForce: number;
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
  /** Re-scatters every node by the initial seeding rule, from the same random stream, and un-settles. */
  reseed(): void;
  /** i < 0 releases the pin. */
  pin(i: number, x: number, y: number): void;
  cursor(x: number, y: number, on: boolean): void;
}

/** Edge count touching each node index. Shared by createPhysics (edge stiffness) and GraphCanvas (node radius, orphan-state derivation) so there's exactly one place this gets computed. */
export function computeDegree(
  edges: ReadonlyArray<{ a: number; b: number }>,
  nodeCount: number,
): Uint16Array {
  const degree = new Uint16Array(nodeCount);
  for (const e of edges) {
    degree[e.a]!++;
    degree[e.b]!++;
  }
  return degree;
}

export interface PhysicsOptions {
  /**
   * Seeds the pseudo-random numbers the solver draws — the initial ring
   * scatter, and the nudge that separates two nodes that land exactly on top
   * of each other. The same seed and the same graph give byte-identical
   * positions at every step, which is what makes a layout reproducible in a
   * test or a screenshot.
   *
   * Omitted, the solver uses `Math.random` and every run differs. This is a
   * PRNG swap and nothing more: the stepping numerics are untouched, so a
   * seeded run is the same physics with a different starting scatter.
   */
  seed?: number;
}

export function createPhysics(graph: PhysicsGraph, options: PhysicsOptions = {}): Physics {
  const n = graph.nodes.length,
    m = graph.edges.length;
  const degree = computeDegree(graph.edges, n);
  // Identity when no seed is given: same function, same call order, same
  // numbers an unseeded solver has always produced.
  const random = options.seed === undefined ? Math.random : mulberry32(options.seed);

  const pos = new Float32Array(n * 2),
    vel = new Float32Array(n * 2);
  const fx = new Float32Array(n),
    fy = new Float32Array(n);
  const charge = new Float32Array(n),
    mass = new Float32Array(n);
  const sector = new Float32Array(n),
    hasSector = new Uint8Array(n);
  const radiusTarget = new Float32Array(n),
    hasRadiusTarget = new Uint8Array(n);
  const eA = new Uint32Array(m),
    eB = new Uint32Array(m);
  const eRest = new Float32Array(m),
    eK = new Float32Array(m);
  const eWA = new Float32Array(m),
    eWB = new Float32Array(m);

  // Targeted nodes seed near their polar target, since a node flung far early can stall before
  // it gets back. Untargeted nodes keep the spiral and its two draws, so the RNG stream is unchanged.
  const SEED_ANGLE_JITTER = (40 * Math.PI) / 180;
  const SEED_RADIUS_JITTER = 70;
  function seedPositions(): void {
    for (let i = 0; i < n; i++) {
      const node = graph.nodes[i]!;
      if (node.sectorAngle === undefined && node.radiusTarget === undefined) {
        const angle = (i / n) * Math.PI * 10,
          radius = 30 + Math.sqrt(i) * 9;
        pos[i * 2] = Math.cos(angle) * radius + (random() - 0.5) * 20;
        pos[i * 2 + 1] = Math.sin(angle) * radius + (random() - 0.5) * 20;
        continue;
      }
      const baseAngle = node.sectorAngle ?? (i / n) * Math.PI * 10;
      const baseRadius = node.radiusTarget ?? 30 + Math.sqrt(i) * 9;
      const angle = baseAngle + (random() - 0.5) * SEED_ANGLE_JITTER;
      const radius = baseRadius + (random() - 0.5) * SEED_RADIUS_JITTER;
      pos[i * 2] = Math.cos(angle) * radius;
      pos[i * 2 + 1] = Math.sin(angle) * radius;
    }
  }
  for (let i = 0; i < n; i++) {
    const node = graph.nodes[i]!;
    charge[i] = node.charge;
    mass[i] = node.mass;
    if (node.sectorAngle !== undefined) {
      sector[i] = node.sectorAngle;
      hasSector[i] = 1;
    }
    if (node.radiusTarget !== undefined) {
      radiusTarget[i] = node.radiusTarget;
      hasRadiusTarget[i] = 1;
    }
  }
  seedPositions();
  // Stiffness normalised by degree, or a 35-link hub diverges under Euler.
  for (let e = 0; e < m; e++) {
    const edge = graph.edges[e]!,
      a = edge.a,
      b = edge.b;
    const da = Math.max(1, degree[a]!),
      db = Math.max(1, degree[b]!);
    eA[e] = a;
    eB[e] = b;
    eRest[e] = edge.dist;
    eK[e] = edge.strength / Math.min(da, db);
    eWA[e] = db / (da + db);
    eWB[e] = da / (da + db);
  }

  let alpha = 1,
    alphaTarget = 0,
    settled = false;
  const A_MIN = 0.0015,
    A_DECAY = 0.0208;
  // Sector/radius forces are constraints, so they decay 6x slower than `alpha` (on alpha, nodes
  // stalled short of their ring); still decaying because repulsion, which spaces them, dies on alpha.
  const S_DECAY = A_DECAY / 6;
  let structAlpha = 1;
  const P: PhysicsParams = {
    repulsion: 900,
    linkDistance: 78,
    gravity: 0.028,
    damping: 0.62,
    cursorForce: 0,
    sectorForce: 0,
    radiusForce: 0,
  };
  let pinIdx = -1,
    pinX = 0,
    pinY = 0,
    curX = 0,
    curY = 0,
    curOn = false;

  function step(): boolean {
    if (settled && pinIdx < 0 && !(curOn && P.cursorForce !== 0)) return false;
    fx.fill(0);
    fy.fill(0);
    const k = P.repulsion * alpha;
    for (let i = 0; i < n; i++) {
      const xi = pos[i * 2]!,
        yi = pos[i * 2 + 1]!,
        ci = charge[i]!;
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j * 2]! - xi,
          dy = pos[j * 2 + 1]! - yi;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-3) {
          dx = random() - 0.5;
          dy = random() - 0.5;
          d2 = dx * dx + dy * dy + 1e-3;
        }
        const f = (k * ci * charge[j]!) / (d2 * Math.sqrt(d2));
        const ax = dx * f,
          ay = dy * f;
        fx[i] -= ax;
        fy[i] -= ay;
        fx[j]! += ax;
        fy[j]! += ay;
      }
    }
    for (let e = 0; e < m; e++) {
      const a = eA[e]!,
        b = eB[e]!;
      let dx = pos[b * 2]! - pos[a * 2]!,
        dy = pos[b * 2 + 1]! - pos[a * 2 + 1]!;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-4) {
        dx = random() - 0.5;
        dy = random() - 0.5;
        d = 1e-2;
      }
      const f = ((d - eRest[e]! * P.linkDistance) / d) * eK[e]! * alpha;
      fx[a] += dx * f * eWA[e]!;
      fy[a] += dy * f * eWA[e]!;
      fx[b]! -= dx * f * eWB[e]!;
      fy[b]! -= dy * f * eWB[e]!;
    }
    const g = P.gravity * alpha,
      damp = P.damping,
      cf = P.cursorForce;
    const sectorStrength = P.sectorForce * structAlpha,
      radiusStrength = P.radiusForce * structAlpha;
    let maxS = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 2]!,
        y = pos[i * 2 + 1]!;
      if (radiusStrength !== 0 && hasRadiusTarget[i] !== 0) {
        const r = Math.sqrt(x * x + y * y);
        if (r > 1e-3) {
          const nx = x / r,
            ny = y / r;
          const pull = (r - radiusTarget[i]!) * radiusStrength;
          fx[i]! -= nx * pull;
          fy[i]! -= ny * pull;
          // Critically damp the radial mode at the current damping so the spring never overshoots;
          // clamped at 0, since a negative term would cancel friction and blow up.
          const dampedStiffness = damp * (radiusStrength / mass[i]!);
          const radialDamping =
            dampedStiffness < 1 ? 1 - Math.pow(1 - Math.sqrt(dampedStiffness), 2) / damp : 1;
          if (radialDamping > 0) {
            const radialVelocity = vel[i * 2]! * nx + vel[i * 2 + 1]! * ny;
            const brake = radialDamping * radialVelocity * mass[i]!;
            fx[i]! -= nx * brake;
            fy[i]! -= ny * brake;
          }
        }
      } else {
        fx[i]! -= x * g;
        fy[i]! -= y * g;
      }
      if (curOn && cf !== 0) {
        const dx = x - curX,
          dy = y - curY,
          d2 = dx * dx + dy * dy + 60;
        const inv = (cf * 14000) / (d2 * Math.sqrt(d2));
        fx[i]! += dx * inv;
        fy[i]! += dy * inv;
      }
      // Tangential only; scaled by radius, capped at 260 so far outliers aren't over-shoved.
      if (sectorStrength !== 0 && hasSector[i] !== 0) {
        const r = Math.sqrt(x * x + y * y);
        if (r > 1e-3) {
          const theta = Math.atan2(y, x);
          let angleDelta = sector[i]! - theta;
          angleDelta -= Math.PI * 2 * Math.round(angleDelta / (Math.PI * 2));
          const magnitude = sectorStrength * angleDelta * Math.min(r, 260);
          fx[i]! += -Math.sin(theta) * magnitude;
          fy[i]! += Math.cos(theta) * magnitude;
        }
      }
      const im = 1 / mass[i]!;
      let vx = (vel[i * 2]! + fx[i]! * im) * damp,
        vy = (vel[i * 2 + 1]! + fy[i]! * im) * damp;
      const s2 = vx * vx + vy * vy;
      if (s2 > 400) {
        const s = 20 / Math.sqrt(s2);
        vx *= s;
        vy *= s;
      }
      if (s2 > maxS) maxS = s2;
      vel[i * 2] = vx;
      vel[i * 2 + 1] = vy;
      pos[i * 2] = x + vx;
      pos[i * 2 + 1] = y + vy;
    }
    if (pinIdx >= 0) {
      pos[pinIdx * 2] = pinX;
      pos[pinIdx * 2 + 1] = pinY;
      vel[pinIdx * 2] = 0;
      vel[pinIdx * 2 + 1] = 0;
    }
    alpha += (alphaTarget - alpha) * A_DECAY;
    structAlpha += (alphaTarget - structAlpha) * S_DECAY;
    if ((alpha < A_MIN || (Math.sqrt(maxS) < 0.004 && alpha < 0.06)) && alphaTarget < A_MIN) {
      settled = true;
      vel.fill(0);
    }
    return true;
  }
  return {
    pos,
    step,
    isSettled: () => settled,
    setParams(p) {
      Object.assign(P, p);
      if ("settle" in p) alphaTarget = p.settle ?? 0;
      settled = false;
      alpha = Math.max(alpha, 0.28);
      structAlpha = Math.max(structAlpha, 0.28);
    },
    reheat(v) {
      settled = false;
      alpha = Math.max(alpha, v);
      structAlpha = Math.max(structAlpha, v);
    },
    reseed() {
      pinIdx = -1;
      seedPositions();
      vel.fill(0);
      settled = false;
      alpha = 1;
      structAlpha = 1;
    },
    pin(i, x, y) {
      pinIdx = i;
      pinX = x;
      pinY = y;
      if (i >= 0) {
        settled = false;
        alpha = Math.max(alpha, 0.35);
        structAlpha = Math.max(structAlpha, 0.35);
      }
    },
    cursor(x, y, on) {
      curX = x;
      curY = y;
      curOn = on;
    },
  };
}
