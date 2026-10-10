/**
 * @vitest-environment jsdom
 *
 * Differential recordings of GraphCanvas at the three.js boundary: reduced
 * motion, context loss and unmount. A diff in __recordings__ means behaviour
 * changed.
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
  session.warmUp();
  session.record();
});
afterEach(() => {
  session.close();
});

it("records reduced motion on, a reseed, a selection and a key under it, then off", async () => {
  const { environment } = session;
  session.step("reduced motion on", () => session.act(() => environment.setReducedMotion(true)));
  session.frames(2);
  // The pan lands before the next frame snaps the camera, so it reads the pose the reseed left.
  const [x, y] = session.emptyPoint();
  session.step(`reseed, then pan 30,20 px from ${x},${y} in the same frame`, () => {
    session.act(() => session.controller.reseed());
    session.pointer("pointerdown", [x, y]);
    session.pointer("pointermove", [x + 30, y + 20]);
    session.pointer("pointerup", [x + 30, y + 20], window);
  });
  session.frames(3);
  session.step("selectedId n3", () => session.render({ selectedId: "n3" }));
  session.frames(3);
  session.step("focus", () => session.act(() => session.focusTarget.focus()));
  session.step("key →", () => session.key("ArrowRight"));
  session.frames(3);
  session.step("reduced motion off", () => session.act(() => environment.setReducedMotion(false)));
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/lifecycle.reduced-motion.txt");
});

it("records a WebGL context loss", async () => {
  session.step("context lost", () =>
    session.dispatch(session.canvas, new Event("webglcontextlost")),
  );
  session.frames(1);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/lifecycle.context-loss.txt");
});

it("records the unmount: listeners off and dispose order", async () => {
  session.step("unmount", () => session.unmount());
  await expect(session.text()).toMatchFileSnapshot("__recordings__/lifecycle.unmount.txt");
});
