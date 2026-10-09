import { describe, expect, it } from "vitest";
import { EFFECTS } from "./effects/index.js";
import { EVENTS } from "./events/index.js";

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

// A repeated id is not a type error: `EffectParam` merges the two param sets
// and `EV_BY_ID` keeps whichever entry comes last.
describe("ids", () => {
  it("every effect id is unique", () => {
    expect(duplicates(EFFECTS.map((effect) => effect.id))).toEqual([]);
  });

  it("every event id is unique", () => {
    expect(duplicates(EVENTS.map((event) => event.id))).toEqual([]);
  });

  it.each(EFFECTS.map((effect) => [effect.id, effect] as const))(
    "every param key of %s is unique",
    (_id, effect) => {
      expect(duplicates(effect.params.map(([key]) => key))).toEqual([]);
    },
  );

  it("finds a repeated value", () => {
    expect(duplicates(["a", "b", "a"])).toEqual(["a"]);
  });
});
