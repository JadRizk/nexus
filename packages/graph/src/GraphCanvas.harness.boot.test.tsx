/**
 * @vitest-environment jsdom
 *
 * Differential recordings of GraphCanvas at the three.js boundary: boot,
 * resize and frame timing. A diff in __recordings__ means behaviour changed.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as Three from "three";
import { variant } from "./harness/fixture.js";
import { openSession } from "./harness/session.js";
import type { Session } from "./harness/session.js";

vi.mock("three", async (importOriginal) => {
  const { mockThree } = await import("./harness/three-recorder.js");
  return mockThree(await importOriginal<typeof Three>());
});

let session: Session;
beforeEach(() => {
  session = openSession();
});
afterEach(() => {
  session.close();
});

it("records the mount and 30 idle frames", async () => {
  session.record();
  session.step("mount", () => session.render());
  session.frames(30);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/boot.mount.txt");
});

it("records a resize from 800×600 to 640×480", async () => {
  session.warmUp();
  session.record();
  session.step("resize to 640x480", () => session.resize(640, 480));
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/boot.resize.txt");
});

it("records a slow frame, which hits the physics step cap", async () => {
  session.warmUp();
  session.record();
  session.step("slow frame", () => session.frames(1, 80));
  session.frames(1);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/boot.slow-frame.txt");
});

it("records the variant fixture: orphan, states, overrides, rich links, dropped edge", async () => {
  session.record();
  session.step("mount the variant fixture, seed 42", () => session.render(variant));
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/boot.variant.txt");
});

/**
 * With `seed={null}` the layout and the shader seeds draw from `Math.random`.
 * The harness feeds three its own stream, so the canvas stream holds only the
 * canvas's draws: layout first, then a seed per node, then a seed per edge.
 * The node and edge seeds land in the node seed and `iP1` hashes on frame 1,
 * and the layout in every position, so a change to that order shows there.
 */
it("records an unseeded mount, which lays out and seeds from Math.random", async () => {
  session.record();
  session.step("mount with seed null", () => session.render({ seed: null }));
  session.frames(1);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/boot.unseeded.txt");
});
