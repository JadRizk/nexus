import { describe, expect, it } from "vitest";
import { EFFECTS } from "../data/effects/index.js";
import { PRESETS } from "../data/presets.js";
import { configFor } from "./config.js";

describe("configFor", () => {
  it("has an entry for every effect", () => {
    expect(Object.keys(configFor("CLEAN")).sort()).toEqual(
      EFFECTS.map((effect) => effect.id).sort(),
    );
  });

  it("puts every param an effect declares at its initial value, when the preset leaves it", () => {
    const config = configFor("TERMINAL");
    const chroma = EFFECTS.find((effect) => effect.id === "chroma");
    for (const [key, , , initial] of chroma?.params ?? []) expect(config.chroma[key]).toBe(initial);
  });

  it("leaves an effect the preset doesn't name off, at mix 1", () => {
    const config = configFor("CLEAN");
    for (const effect of EFFECTS) {
      if (effect.id !== "crt") expect(config[effect.id]).toMatchObject({ on: 0, amt: 1 });
    }
  });

  it("applies the preset's knobs over the defaults", () => {
    expect(configFor("TERMINAL").crush).toMatchObject(PRESETS.TERMINAL.crush);
  });

  it("returns a fresh object on each call", () => {
    const first = configFor("CLEAN");
    const second = configFor("CLEAN");
    expect(first).not.toBe(second);
    expect(first.crt).not.toBe(second.crt);
  });

  it("leaves PRESETS unchanged when a result is mutated", () => {
    const before = structuredClone(PRESETS);
    for (const preset of Object.keys(PRESETS)) {
      for (const knobs of Object.values(configFor(preset))) {
        for (const knob of Object.keys(knobs)) knobs[knob] = -999;
      }
    }
    expect(PRESETS).toEqual(before);
  });

  it("throws a TypeError for an unknown preset", () => {
    expect(() => configFor("NO SUCH PRESET")).toThrow(TypeError);
  });
});
