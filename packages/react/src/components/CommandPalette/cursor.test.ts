import { describe, expect, it } from "vitest";
import { nextCursor } from "./cursor.js";

describe("nextCursor", () => {
  it("moves down one, stopping on the last result", () => {
    expect(nextCursor("ArrowDown", 0, 3)).toBe(1);
    expect(nextCursor("ArrowDown", 2, 3)).toBe(2);
  });

  it("moves up one, stopping on the first result", () => {
    expect(nextCursor("ArrowUp", 2, 3)).toBe(1);
    expect(nextCursor("ArrowUp", 0, 3)).toBe(0);
  });

  it("jumps to the first and last result", () => {
    expect(nextCursor("Home", 2, 3)).toBe(0);
    expect(nextCursor("End", 0, 3)).toBe(2);
  });

  it("stays at 0 for ArrowUp, Home and End with no results", () => {
    expect(nextCursor("ArrowUp", 0, 0)).toBe(0);
    expect(nextCursor("Home", 0, 0)).toBe(0);
    expect(nextCursor("End", 0, 0)).toBe(0);
  });

  it("currently returns -1 for ArrowDown with no results (#91)", () => {
    expect(nextCursor("ArrowDown", 0, 0)).toBe(-1);
  });

  it("returns undefined for keys that don't move the cursor", () => {
    expect(nextCursor("Enter", 1, 3)).toBeUndefined();
    expect(nextCursor("a", 1, 3)).toBeUndefined();
  });
});
