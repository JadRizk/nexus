import { describe, expect, it } from "vitest";
import { isTextEntry } from "./keys.js";

const element = (tagName: string) => Object.assign(new EventTarget(), { tagName });

describe("isTextEntry", () => {
  it.each(["INPUT", "TEXTAREA"])("is true for an %s", (tagName) => {
    expect(isTextEntry(element(tagName))).toBe(true);
  });

  it.each(["BUTTON", "DIV", "SELECT", "input"])("is false for %s", (tagName) => {
    expect(isTextEntry(element(tagName))).toBe(false);
  });

  it("is false for a target that is not an element, or none", () => {
    expect(isTextEntry(new EventTarget())).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
