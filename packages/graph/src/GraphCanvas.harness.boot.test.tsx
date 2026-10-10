/**
 * @vitest-environment jsdom
 *
 * Differential recordings of GraphCanvas at the three.js boundary: boot,
 * resize and frame timing. A diff in __recordings__ means behaviour changed.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as Three from "three";
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
