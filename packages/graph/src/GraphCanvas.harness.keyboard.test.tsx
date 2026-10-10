/**
 * @vitest-environment jsdom
 *
 * Differential recordings of GraphCanvas at the three.js boundary: keyboard
 * navigation. A diff in __recordings__ means behaviour changed.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as Three from "three";
import { openSession } from "./harness/session.js";
import type { Session } from "./harness/session.js";

vi.mock("three", async (importOriginal) => {
  const { mockThree } = await import("./harness/three-recorder.js");
  return mockThree(await importOriginal<typeof Three>());
});

const KEYS = [
  ["ArrowRight", "→"],
  ["Enter", "Enter"],
  [" ", "Space"],
  ["ArrowDown", "↓"],
  ["Backspace", "Backspace"],
  ["Escape", "Escape"],
] as const;

let session: Session;
beforeEach(() => {
  session = openSession();
});
afterEach(() => {
  session.close();
});

it("records focus, then →, Enter, Space, ↓, Backspace and Escape", async () => {
  session.warmUp();
  session.record();
  session.step("focus", () => session.act(() => session.focusTarget.focus()));
  session.frames(2);
  for (const [key, name] of KEYS) {
    session.step(`key ${name}`, () => session.key(key));
    session.frames(2);
  }
  await expect(session.text()).toMatchFileSnapshot("__recordings__/keyboard.navigate.txt");
});
