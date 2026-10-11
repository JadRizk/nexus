import { describe, expect, it } from "vitest";
import { createPhysics } from "./physics.js";

const NO_FORCES = { repulsion: 0, linkDistance: 1, gravity: 0, damping: 0.5, cursorForce: 0 };

// Recorded from the 1.x solver; nine significant digits round-trip a float32 exactly.
// prettier-ignore
const V1_GOLDEN = [18.9124947,4.15760183,-56.6989594,24.8807526,27.4507599,-50.2749481,-3.16198254,35.3550072,-25.6373863,-39.3361092,74.9694595,29.6277485,-23.4488106,0.641816258,85.5588455,-33.0581703,-39.9154968,84.2616272,-8.41025829,-77.380127,29.3776951,69.8672104,-79.9296341,-44.4288292];

describe("createPhysics", () => {
  it("settles to a stop when there are no forces at all", () => {
    const sim = createPhysics({
      nodes: [
        { charge: 1, mass: 1 },
        { charge: 1, mass: 1 },
      ],
      edges: [],
    });
    sim.setParams({ repulsion: 0, linkDistance: 1, gravity: 0, damping: 0.5, cursorForce: 0 });
    let steps = 0;
    while (sim.step() && steps < 2000) steps++;
    expect(sim.isSettled()).toBe(true);
  });

  it("pulls two linked nodes toward the configured rest distance", () => {
    const sim = createPhysics({
      nodes: [
        { charge: 1, mass: 1 },
        { charge: 1, mass: 1 },
      ],
      edges: [{ a: 0, b: 1, dist: 1, strength: 1 }],
    });
    sim.setParams({ repulsion: 0, linkDistance: 50, gravity: 0, damping: 0.6, cursorForce: 0 });
    for (let i = 0; i < 500; i++) sim.step();
    const dx = sim.pos[2] - sim.pos[0],
      dy = sim.pos[3] - sim.pos[1];
    const d = Math.sqrt(dx * dx + dy * dy);
    // rest distance = eRest(1) * linkDistance(50) = 50 — generous band around it,
    // this is checking convergence toward the target, not exact equilibrium.
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(70);
  });

  it("repulsion alone pushes two nodes further apart over time", () => {
    const sim = createPhysics({
      nodes: [
        { charge: 1, mass: 1 },
        { charge: 1, mass: 1 },
      ],
      edges: [],
    });
    sim.setParams({ repulsion: 900, linkDistance: 1, gravity: 0, damping: 0.6, cursorForce: 0 });
    const before = Math.hypot(sim.pos[2] - sim.pos[0], sim.pos[3] - sim.pos[1]);
    for (let i = 0; i < 200; i++) sim.step();
    const after = Math.hypot(sim.pos[2] - sim.pos[0], sim.pos[3] - sim.pos[1]);
    expect(after).toBeGreaterThan(before);
  });

  it("gravity alone pulls a node back toward the origin", () => {
    const sim = createPhysics({ nodes: [{ charge: 1, mass: 1 }], edges: [] });
    sim.pin(-1, 0, 0); // no-op, just confirms pin(-1,...) doesn't throw
    sim.setParams({ repulsion: 0, linkDistance: 1, gravity: 0.05, damping: 0.6, cursorForce: 0 });
    const before = Math.hypot(sim.pos[0], sim.pos[1]);
    for (let i = 0; i < 300; i++) sim.step();
    const after = Math.hypot(sim.pos[0], sim.pos[1]);
    expect(after).toBeLessThan(before);
  });

  it("pin locks a node's position through subsequent steps", () => {
    const sim = createPhysics({
      nodes: [
        { charge: 1, mass: 1 },
        { charge: 1, mass: 1 },
      ],
      edges: [{ a: 0, b: 1, dist: 1, strength: 1 }],
    });
    sim.setParams({
      repulsion: 900,
      linkDistance: 78,
      gravity: 0.02,
      damping: 0.6,
      cursorForce: 0,
    });
    sim.pin(0, 123, -45);
    for (let i = 0; i < 50; i++) sim.step();
    expect(sim.pos[0]).toBeCloseTo(123);
    expect(sim.pos[1]).toBeCloseTo(-45);
  });

  describe("seed", () => {
    const graph = {
      nodes: Array.from({ length: 12 }, () => ({ charge: 1, mass: 1 })),
      edges: [
        { a: 0, b: 1, dist: 1, strength: 1 },
        { a: 1, b: 2, dist: 1, strength: 1 },
        { a: 3, b: 4, dist: 1, strength: 1 },
      ],
    };
    const run = (seed?: number) => {
      const sim = createPhysics(graph, seed === undefined ? {} : { seed });
      for (let i = 0; i < 60; i++) sim.step();
      return Array.from(sim.pos);
    };

    it("gives the same layout twice for the same seed", () => {
      expect(run(1234)).toEqual(run(1234));
    });

    it("gives a different layout for a different seed", () => {
      expect(run(1234)).not.toEqual(run(4321));
    });

    it("falls back to Math.random when no seed is given", () => {
      // The unseeded path is the one every existing numerics test above runs
      // through, so this only has to show it is still non-deterministic —
      // i.e. that the PRNG swap did not quietly become the default.
      expect(run()).not.toEqual(run());
    });
  });

  it("with sectorForce and radiusForce at 0, steps byte-identically to the 1.x solver", () => {
    const sim = createPhysics(
      {
        nodes: Array.from({ length: 12 }, (_, i) => ({
          charge: 1 + (i % 3) * 0.5,
          mass: 1 + (i % 2),
        })),
        edges: [
          { a: 0, b: 1, dist: 1, strength: 1 },
          { a: 1, b: 2, dist: 1.4, strength: 0.6 },
          { a: 3, b: 4, dist: 1, strength: 1 },
          { a: 2, b: 7, dist: 0.8, strength: 1 },
          { a: 0, b: 7, dist: 1, strength: 0.5 },
        ],
      },
      { seed: 1234 },
    );
    sim.setParams({ settle: 0 });
    for (let i = 0; i < 120; i++) sim.step();
    expect(Array.from(sim.pos)).toEqual(Array.from(Float32Array.from(V1_GOLDEN)));
  });

  it("radius force pulls a node toward its target ring instead of the origin, overriding plain gravity", () => {
    const sim = createPhysics({ nodes: [{ charge: 1, mass: 1, radiusTarget: 150 }], edges: [] });
    sim.pin(0, 400, 0);
    sim.step();
    sim.pin(-1, 0, 0);
    sim.setParams({ ...NO_FORCES, gravity: 0.05, damping: 0.6, radiusForce: 0.05 });
    for (let i = 0; i < 400; i++) sim.step();
    const radius = Math.hypot(sim.pos[0], sim.pos[1]);
    expect(radius).toBeGreaterThan(100);
    expect(radius).toBeLessThan(200);
  });

  // Guards the structural forces' own slower decay: on the shared alpha a far node stalls short.
  it("radius force converges from a large displacement, not just partway", () => {
    for (const start of [500, 900, 1400]) {
      const sim = createPhysics({ nodes: [{ charge: 1, mass: 1, radiusTarget: 150 }], edges: [] });
      sim.pin(0, start, 0);
      sim.step();
      sim.pin(-1, 0, 0);
      sim.setParams({ ...NO_FORCES, gravity: 0.05, damping: 0.62, radiusForce: 0.05 });
      let steps = 0;
      while (sim.step() && steps < 5000) steps++;
      const radius = Math.hypot(sim.pos[0], sim.pos[1]);
      expect(Math.abs(radius - 150)).toBeLessThan(1.5);
    }
  });

  // Critical stiffness is (1-sqrt(damp))^2/damp, so 0.05 is far above it at damping 0.9.
  it("radius force does not overshoot its ring, even at low-friction damping", () => {
    const sim = createPhysics({ nodes: [{ charge: 1, mass: 1, radiusTarget: 150 }], edges: [] });
    sim.pin(0, 650, 0);
    sim.step();
    sim.pin(-1, 0, 0);
    sim.setParams({ ...NO_FORCES, gravity: 0.05, damping: 0.9, radiusForce: 0.05 });
    let steps = 0,
      minRadius = Infinity;
    while (sim.step() && steps < 5000) {
      minRadius = Math.min(minRadius, Math.hypot(sim.pos[0], sim.pos[1]));
      steps++;
    }
    expect(minRadius).toBeGreaterThan(150 - 5);
    expect(Math.abs(Math.hypot(sim.pos[0], sim.pos[1]) - 150)).toBeLessThan(1.5);
  });

  it("radius force is inert at zero, even on a node carrying a radiusTarget", () => {
    const sim = createPhysics({ nodes: [{ charge: 1, mass: 1, radiusTarget: 150 }], edges: [] });
    sim.pin(0, 400, 0);
    sim.step();
    sim.pin(-1, 0, 0);
    sim.setParams({ ...NO_FORCES, gravity: 0.05, damping: 0.6 });
    const before = Math.hypot(sim.pos[0], sim.pos[1]);
    for (let i = 0; i < 300; i++) sim.step();
    expect(Math.hypot(sim.pos[0], sim.pos[1])).toBeLessThan(before);
  });

  it("sector force rotates a node toward its arm angle while roughly preserving its radius", () => {
    const sim = createPhysics({
      nodes: [{ charge: 1, mass: 1, sectorAngle: Math.PI / 2 }],
      edges: [],
    });
    sim.pin(0, 100, 0);
    sim.step();
    sim.pin(-1, 0, 0);
    sim.setParams({ ...NO_FORCES, damping: 0.6, sectorForce: 0.02 });
    const before = { x: sim.pos[0], y: sim.pos[1] };
    for (let i = 0; i < 300; i++) sim.step();
    const after = { x: sim.pos[0], y: sim.pos[1] };
    expect(Math.abs(Math.PI / 2 - Math.atan2(after.y, after.x))).toBeLessThan((2 * Math.PI) / 180);
    const radiusBefore = Math.hypot(before.x, before.y),
      radiusAfter = Math.hypot(after.x, after.y);
    expect(radiusAfter).toBeGreaterThan(radiusBefore * 0.5);
    expect(radiusAfter).toBeLessThan(radiusBefore * 1.5);
  });

  it("sector force is inert at zero, even on a node carrying a sectorAngle", () => {
    const sim = createPhysics({
      nodes: [{ charge: 1, mass: 1, sectorAngle: Math.PI / 2 }],
      edges: [],
    });
    sim.pin(0, 100, 0);
    sim.step();
    sim.pin(-1, 0, 0);
    sim.setParams({ ...NO_FORCES, damping: 0.6 });
    for (let i = 0; i < 100; i++) sim.step();
    expect(sim.pos[1]).toBeCloseTo(0, 5);
  });

  it("seeds a targeted node near its polar target, within the documented jitter", () => {
    const nodes = Array.from({ length: 40 }, () => ({
      charge: 1,
      mass: 1,
      sectorAngle: Math.PI / 4,
      radiusTarget: 200,
    }));
    const sim = createPhysics({ nodes, edges: [] }, { seed: 7 });
    for (let i = 0; i < 40; i++) {
      const x = sim.pos[i * 2],
        y = sim.pos[i * 2 + 1];
      expect(Math.abs(Math.hypot(x, y) - 200)).toBeLessThanOrEqual(35);
      expect(Math.abs(Math.atan2(y, x) - Math.PI / 4)).toBeLessThanOrEqual((20 * Math.PI) / 180);
    }
  });

  describe("reseed", () => {
    const graph = {
      nodes: Array.from({ length: 10 }, (_, i) =>
        i < 5 ? { charge: 1, mass: 1, sectorAngle: i, radiusTarget: 120 } : { charge: 1, mass: 1 },
      ),
      edges: [{ a: 0, b: 6, dist: 1, strength: 1 }],
    };
    const runWithReseed = (seed: number) => {
      const sim = createPhysics(graph, { seed });
      sim.setParams({ sectorForce: 0.02, radiusForce: 0.05 });
      for (let i = 0; i < 40; i++) sim.step();
      sim.reseed();
      const afterReseed = Array.from(sim.pos);
      for (let i = 0; i < 40; i++) sim.step();
      return { afterReseed, end: Array.from(sim.pos) };
    };

    it("re-scatters the layout and un-settles the solver", () => {
      const sim = createPhysics(graph, { seed: 3 });
      sim.setParams({ ...NO_FORCES, damping: 0.5 });
      while (sim.step()) {
        /* run to settled */
      }
      const settledAt = Array.from(sim.pos);
      sim.reseed();
      expect(sim.isSettled()).toBe(false);
      expect(Array.from(sim.pos)).not.toEqual(settledAt);
    });

    it("releases a pinned node", () => {
      const sim = createPhysics(graph, { seed: 3 });
      sim.pin(0, 500, 500);
      sim.reseed();
      sim.step();
      expect([sim.pos[0], sim.pos[1]]).not.toEqual([500, 500]);
    });

    it("is reproducible for a seeded solver, structural forces included", () => {
      expect(runWithReseed(99)).toEqual(runWithReseed(99));
      expect(runWithReseed(99).afterReseed).not.toEqual(runWithReseed(100).afterReseed);
    });
  });

  it("reheat un-settles a settled simulation", () => {
    const sim = createPhysics({ nodes: [{ charge: 1, mass: 1 }], edges: [] });
    sim.setParams({ repulsion: 0, linkDistance: 1, gravity: 0, damping: 0.5, cursorForce: 0 });
    while (sim.step()) {
      /* run to settled */
    }
    expect(sim.isSettled()).toBe(true);
    sim.reheat(1);
    expect(sim.isSettled()).toBe(false);
  });
});
