/**
 * @vitest-environment jsdom
 *
 * Differential recordings of GraphCanvas at the three.js boundary: prop
 * changes and the controller. A diff in __recordings__ means behaviour changed.
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

it("records setting the selectedId prop", async () => {
  session.step("selectedId n3", () => session.render({ selectedId: "n3" }));
  session.frames(3);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.selected-id.txt");
});

it("records hiding a node and a link category", async () => {
  session.step("hide leaf nodes and refs links", () =>
    session.render({ hiddenNodeCategories: ["leaf"], hiddenLinkCategories: ["refs"] }),
  );
  session.frames(3);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.hide-categories.txt");
});

it("records a reseed through the controller", async () => {
  session.step("reseed", () => session.act(() => session.controller.reseed()));
  session.frames(5);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.reseed.txt");
});

it("records an optics change", async () => {
  session.step("edge opacity 0.7, trails 0.5, glitch 0.8", () =>
    session.render({ optics: { edgeOpacity: 0.7, trails: 0.5, glitch: 0.8 } }),
  );
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.optics.txt");
});
