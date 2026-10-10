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

it("records hiding a node category, then a link category", async () => {
  session.step("hide leaf nodes", () => session.render({ hiddenNodeCategories: ["leaf"] }));
  session.frames(3);
  session.step("hide refs links", () => session.render({ hiddenLinkCategories: ["refs"] }));
  session.frames(3);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.hide-categories.txt");
});

it("records isolating a node, then clearing it", async () => {
  session.step("isolateId n0", () => session.render({ isolateId: "n0" }));
  session.frames(3);
  session.step("isolateId null", () => session.render({ isolateId: null }));
  session.frames(2);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.isolate.txt");
});

it("records refs links scoped to the selection, then a selection", async () => {
  session.step("scope refs links to the selection", () =>
    session.render({ selectionScopedLinkCategories: ["refs"] }),
  );
  session.frames(3);
  session.step("selectedId n0", () => session.render({ selectedId: "n0" }));
  session.frames(3);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.scoped-links.txt");
});

it("records a fit inset change", async () => {
  session.step("fitInset top 60, left 200", () =>
    session.render({ fitInset: { top: 60, left: 200 } }),
  );
  session.frames(3);
  await expect(session.text()).toMatchFileSnapshot("__recordings__/props.fit-inset.txt");
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
