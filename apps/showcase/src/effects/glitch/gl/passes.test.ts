import { describe, expect, it } from "vitest";
import { EFFECTS } from "../data/effects/index.js";
import { configFor } from "../core/config.js";
import type { Config } from "../core/config.js";
import type { PlannedEffect } from "./passes.js";
import { planPasses } from "./passes.js";

/** An effect with two knobs: `gain` in 0–1 and `width` in 2–20. */
const TEST_EFFECT: PlannedEffect = {
  id: "chroma",
  group: "SIGNAL",
  label: "TEST",
  note: "",
  params: [
    ["gain", 0, 1, 0.5],
    ["width", 2, 20, 4],
  ],
  frag: "",
};

/** Every effect off, then `knobs` on the test effect. */
function configWith(knobs: Record<string, number>): Config {
  const config = configFor("CLEAN");
  for (const effect of EFFECTS) config[effect.id].on = 0;
  config.chroma = knobs;
  return config;
}

describe("planPasses: the mix", () => {
  it("draws an effect that is on at its resting amt", () => {
    const [pass] = planPasses(
      [TEST_EFFECT],
      configWith({ on: 1, amt: 0.6, gain: 0.5, width: 4 }),
      {},
    );
    expect(pass?.amt).toBe(0.6);
  });

  it("treats an effect that is off as a mix of 0, so it has no pass", () => {
    const passes = planPasses(
      [TEST_EFFECT],
      configWith({ on: 0, amt: 1, gain: 0.5, width: 4 }),
      {},
    );
    expect(passes).toEqual([]);
  });

  it("raises the mix to an override's amt when that is higher", () => {
    const config = configWith({ on: 1, amt: 0.2, gain: 0.5, width: 4 });
    const [pass] = planPasses([TEST_EFFECT], config, { chroma: { amt: 0.9 } });
    expect(pass?.amt).toBe(0.9);
  });

  it("keeps the resting mix when an override's amt is lower", () => {
    const config = configWith({ on: 1, amt: 0.7, gain: 0.5, width: 4 });
    const [pass] = planPasses([TEST_EFFECT], config, { chroma: { amt: 0.1 } });
    expect(pass?.amt).toBe(0.7);
  });

  it("lets an override's amt bring in an effect that is off", () => {
    const config = configWith({ on: 0, amt: 1, gain: 0.5, width: 4 });
    const [pass] = planPasses([TEST_EFFECT], config, { chroma: { amt: 0.4 } });
    expect(pass?.amt).toBe(0.4);
  });

  it("skips a mix at or under 0.001, and draws one just over it", () => {
    const at = configWith({ on: 1, amt: 0.001, gain: 0.5, width: 4 });
    const over = configWith({ on: 1, amt: 0.0011, gain: 0.5, width: 4 });
    expect(planPasses([TEST_EFFECT], at, {})).toEqual([]);
    expect(planPasses([TEST_EFFECT], over, {})).toHaveLength(1);
  });
});

describe("planPasses: the uniforms", () => {
  it("names each param u_<key>, in params order", () => {
    const [pass] = planPasses(
      [TEST_EFFECT],
      configWith({ on: 1, amt: 1, gain: 0.3, width: 8 }),
      {},
    );
    expect(Object.entries(pass?.uniforms ?? {})).toEqual([
      ["u_gain", 0.3],
      ["u_width", 8],
    ]);
  });

  it("replaces a resting knob with an overridden one, and keeps the rest", () => {
    const config = configWith({ on: 1, amt: 1, gain: 0.3, width: 8 });
    const [pass] = planPasses([TEST_EFFECT], config, { chroma: { width: 12 } });
    expect(pass?.uniforms).toEqual({ u_gain: 0.3, u_width: 12 });
  });

  it("clamps every param to its range, resting or overridden", () => {
    const config = configWith({ on: 1, amt: 1, gain: 4, width: 8 });
    const [pass] = planPasses([TEST_EFFECT], config, { chroma: { width: -3 } });
    expect(pass?.uniforms).toEqual({ u_gain: 1, u_width: 2 });
  });

  it("reads a knob missing from the config as NaN", () => {
    const [pass] = planPasses([TEST_EFFECT], configWith({ on: 1, amt: 1, gain: 0.3 }), {});
    expect(pass?.uniforms.u_width).toBeNaN();
  });
});

describe("planPasses: the order and the feedback flag", () => {
  it("keeps the order effects come in, which is EFFECTS' signal-path order", () => {
    const config = configFor("CLEAN");
    for (const effect of EFFECTS) Object.assign(config[effect.id], { on: 1, amt: 1 });

    const passes = planPasses(EFFECTS, config, {});

    expect(passes.map((pass) => pass.effect.id)).toEqual(EFFECTS.map((effect) => effect.id));
  });

  it("flags the feedback effect, and only it", () => {
    const config = configFor("CLEAN");
    for (const effect of EFFECTS) Object.assign(config[effect.id], { on: 1, amt: 1 });

    const flagged = planPasses(EFFECTS, config, {}).filter((pass) => pass.isFeedback);

    expect(flagged.map((pass) => pass.effect.id)).toEqual(["feedback"]);
  });

  it("passes the effect's own definition through", () => {
    const [pass] = planPasses(
      [TEST_EFFECT],
      configWith({ on: 1, amt: 1, gain: 0.5, width: 4 }),
      {},
    );
    expect(pass?.effect).toBe(TEST_EFFECT);
  });
});
