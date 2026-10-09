/* ============================================================================
   PHYSICS

   The stepping numerics are byte-for-byte identical to the prototype this
   was extracted from, as long as `sectorForce` and `radiusForce` stay at
   their default of 0 (a test pins that against a recorded 1.x run). The one
   other change is the input shape: the
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
  /**
   * Radians. When set, the node feels a gentle tangential force rotating it
   * toward this angle (measured from the origin) — a soft "stay in your
   * arm/sector" bias, layered on top of repulsion/spring/gravity rather than
   * replacing them. Radius is untouched; only angular position is nudged.
   * Undefined means no bias.
   */
  sectorAngle?: number;
  /**
   * World units. When set, the node feels a radial spring toward this
   * distance from the origin — the "which ring" counterpart to sectorAngle's
   * "which arm". A node that has one uses this *instead of* the generic
   * linear gravity (see radiusForce), not in addition to it: two always-on
   * inward pulls competing over the same radius would settle at neither.
   * Undefined means no target, so the node keeps ordinary gravity-to-origin.
   */
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
  /** Strength of the per-node sectorAngle bias. 0 disables it outright, whichever nodes carry a sectorAngle. */
  sectorForce: number;
  /** Strength of the per-node radiusTarget spring. 0 disables it: a node with a radiusTarget then falls back to ordinary gravity, exactly as if it had no target. */
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
  /**
   * Re-scatters every node with the same seeding rule as the initial layout
   * and un-settles the solver — a fresh arrangement of the same graph. Draws
   * from the same random stream, so a seeded solver's sequence of reseeds is
   * reproducible too.
   */
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

  // A node with a sectorAngle/radiusTarget seeds *near* that polar position
  // instead of on the generic spiral. The structural forces alone aren't
  // enough to get it there: they anneal like everything else, so a node that
  // repulsion flings far from its ring early on can run out of force before
  // it migrates back. Starting close means physics only does local
  // relaxation, and the ring/arm structure is right from the first frame.
  //
  // "Near", not "at": the jitter is real spread (±20° of arc, ±35 units of
  // radius), re-drawn on every call, so reseed() lands each node somewhere
  // new within its own wedge and ring rather than snapping back to one point.
  // Nodes with no target keep the spiral exactly as before — same formula,
  // same two draws per node in the same order — so a graph that uses neither
  // feature seeds byte-identically to a solver without this code.
  const SEED_ANGLE_JITTER = (40 * Math.PI) / 180;
  const SEED_RADIUS_JITTER = 70;
  function seedPositions(): void {
    for (let i = 0; i < n; i++) {
      const node = graph.nodes[i]!;
      if (node.sectorAngle === undefined && node.radiusTarget === undefined) {
        const a = (i / n) * Math.PI * 10,
          r = 30 + Math.sqrt(i) * 9;
        pos[i * 2] = Math.cos(a) * r + (random() - 0.5) * 20;
        pos[i * 2 + 1] = Math.sin(a) * r + (random() - 0.5) * 20;
        continue;
      }
      const baseA = node.sectorAngle ?? (i / n) * Math.PI * 10;
      const baseR = node.radiusTarget ?? 30 + Math.sqrt(i) * 9;
      const a = baseA + (random() - 0.5) * SEED_ANGLE_JITTER;
      const r = baseR + (random() - 0.5) * SEED_RADIUS_JITTER;
      pos[i * 2] = Math.cos(a) * r;
      pos[i * 2 + 1] = Math.sin(a) * r;
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
  // sectorForce/radiusForce run on their own, slower-decaying schedule rather
  // than sharing `alpha` with repulsion, links and gravity. Those three are
  // exploratory: `alpha` is an annealing temperature, and decaying it is what
  // makes the layout stop wandering. The structural two are constraints —
  // "this node belongs on that ring, in that arm" is as true at second five
  // as at second one — and annealing them on `alpha` left a node still
  // travelling toward its ring without the force carrying it there (measured
  // in qrntn: 500 units off its ring it stalled ~9 short, 750 off ~20 short).
  //
  // Still decays, ~6x slower, because repulsion is what keeps nodes sharing
  // one arm and one ring from stacking on one point, and repulsion dies on
  // the `alpha` schedule. Six is the measured knee: converges well inside
  // the settle window, leaves nearest-neighbour spacing within a ring alone.
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
    const sf = P.sectorForce * structAlpha,
      rf = P.radiusForce * structAlpha;
    let maxS = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 2]!,
        y = pos[i * 2 + 1]!;
      // A node with a radiusTarget gets a spring toward that ring instead of
      // the generic pull to the origin — see PhysicsNode.radiusTarget on why
      // the two don't stack. rf === 0 falls through to ordinary gravity, so a
      // target with no force behind it is the same as no target at all.
      if (rf !== 0 && hasRadiusTarget[i] !== 0) {
        const r = Math.sqrt(x * x + y * y);
        if (r > 1e-3) {
          const nx = x / r,
            ny = y / r;
          const pull = (r - radiusTarget[i]!) * rf;
          fx[i]! -= nx * pull;
          fy[i]! -= ny * pull;
          // Anti-overshoot, on the radial axis only. The spring's stability
          // depends on `damping`, a consumer-set prop: solving the step
          // recurrence gives a critical stiffness of (1-sqrt(damp))^2/damp —
          // 0.073 at the default 0.62, but only 0.003 at 0.90, where the same
          // radiusForce rings (measured: 66 units of overshoot from 500 out).
          // A velocity term sized to critically damp the radial mode at the
          // damping actually in force cancels that.
          //
          // Clamped at zero on purpose. Below critical stiffness the exact
          // solution wants a negative coefficient, which would cancel part of
          // the global friction — but this node also carries repulsion and
          // link springs on the same axis, so that trades a slow settle for a
          // blow-up. Convergence is the schedule's job (S_DECAY); this term's
          // only job is to never overshoot.
          const dk = damp * (rf / mass[i]!);
          const c = dk < 1 ? 1 - Math.pow(1 - Math.sqrt(dk), 2) / damp : 1;
          if (c > 0) {
            const vr = vel[i * 2]! * nx + vel[i * 2 + 1]! * ny;
            const f = c * vr * mass[i]!;
            fx[i]! -= nx * f;
            fy[i]! -= ny * f;
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
      // Sector bias: a torque-like nudge toward the node's arm angle, scaled
      // by radius (so the correction is roughly rotation-consistent however
      // far out the node sits) and clamped past 260 units so far outliers
      // don't get an outsized shove. Purely tangential: it never touches
      // radial distance, so it composes with repulsion and gravity.
      if (sf !== 0 && hasSector[i] !== 0) {
        const r = Math.sqrt(x * x + y * y);
        if (r > 1e-3) {
          const theta = Math.atan2(y, x);
          let d = sector[i]! - theta;
          d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
          const mag = sf * d * Math.min(r, 260);
          fx[i]! += -Math.sin(theta) * mag;
          fy[i]! += Math.cos(theta) * mag;
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
