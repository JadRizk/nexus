/**
 * @vitest-environment jsdom
 *
 * Differential recordings of GraphCanvas at the three.js boundary: pointer and
 * wheel input. A diff in __recordings__ means behaviour changed.
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

it("records a hover near the right edge, where the tooltip flips to the left", async () => {
  const index = session.rightmostNode();
  session.step(`hover node ${index}`, () =>
    session.pointer("pointermove", session.nodePoint(index)),
  );
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/input.hover-edge.txt");
});

it("records a 40 px node drag", async () => {
  const [x, y] = session.nodePoint(0);
  session.step("press node 0", () => session.pointer("pointerdown", [x, y]));
  session.step("move 40 px", () => session.pointer("pointermove", [x + 40, y]));
  session.frames(3);
  session.step("release", () => session.pointer("pointerup", [x + 40, y], window));
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/input.drag.txt");
});

it("records a 3.5 px press-release, just past the drag slop", async () => {
  const [x, y] = session.nodePoint(3);
  session.step("press node 3", () => session.pointer("pointerdown", [x, y]));
  session.step("move 3.5 px", () => session.pointer("pointermove", [x + 3.5, y]));
  session.step("release and click", () => {
    session.pointer("pointerup", [x + 3.5, y], window);
    session.pointer("click", [x + 3.5, y]);
  });
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/input.press-release.txt");
});

it("records a pan on empty space", async () => {
  const [x, y] = session.emptyPoint();
  session.step(`press empty space at ${x},${y}`, () => session.pointer("pointerdown", [x, y]));
  session.step("move 30,20 px", () => session.pointer("pointermove", [x + 30, y + 20]));
  session.frames(3);
  session.step("release", () => session.pointer("pointerup", [x + 30, y + 20], window));
  await expect(session.text()).toMatchFileSnapshot("__recordings__/input.pan.txt");
});

it("records a wheel zoom anchored off-centre", async () => {
  session.step("wheel in at 160,120", () => session.wheel([160, 120], -120));
  session.frames(3);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/input.wheel.txt");
});

it("records a click on a node", async () => {
  const point = session.nodePoint(6);
  session.step("hover node 6", () => session.pointer("pointermove", point));
  session.frames(1);
  session.step("click node 6", () => {
    session.pointer("pointerdown", point);
    session.pointer("pointerup", point, window);
    session.pointer("click", point);
  });
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/input.click.txt");
});
