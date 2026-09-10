import { describe, expect, it } from "vitest";
import { createPhysics } from "./physics.js";

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
    const dx = sim.pos[2]! - sim.pos[0]!,
      dy = sim.pos[3]! - sim.pos[1]!;
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
    const before = Math.hypot(sim.pos[2]! - sim.pos[0]!, sim.pos[3]! - sim.pos[1]!);
    for (let i = 0; i < 200; i++) sim.step();
    const after = Math.hypot(sim.pos[2]! - sim.pos[0]!, sim.pos[3]! - sim.pos[1]!);
    expect(after).toBeGreaterThan(before);
  });

  it("gravity alone pulls a node back toward the origin", () => {
    const sim = createPhysics({ nodes: [{ charge: 1, mass: 1 }], edges: [] });
    sim.pin(-1, 0, 0); // no-op, just confirms pin(-1,...) doesn't throw
    sim.setParams({ repulsion: 0, linkDistance: 1, gravity: 0.05, damping: 0.6, cursorForce: 0 });
    const before = Math.hypot(sim.pos[0]!, sim.pos[1]!);
    for (let i = 0; i < 300; i++) sim.step();
    const after = Math.hypot(sim.pos[0]!, sim.pos[1]!);
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
