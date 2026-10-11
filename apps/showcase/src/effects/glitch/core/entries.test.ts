import { describe, expect, it } from "vitest";
import { entriesOf } from "./entries.js";

describe("entriesOf", () => {
  it("returns the same pairs as Object.entries, in the same order", () => {
    const table = { b: 2, a: 1, c: { nested: true } } as const;
    expect(entriesOf(table)).toEqual(Object.entries(table));
  });

  it("keeps the table's key type", () => {
    const table = { on: 1, amt: 0.5 } as const;
    const keys: ("on" | "amt")[] = entriesOf(table).map(([key]) => key);
    expect(keys).toEqual(["on", "amt"]);
  });
});
