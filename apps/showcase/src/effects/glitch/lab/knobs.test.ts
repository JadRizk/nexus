import { describe, expect, it } from "vitest";
import { configFor } from "../core/config.js";
import { withKnob } from "./knobs.js";

describe("withKnob", () => {
  it("sets one knob and keeps the effect's others", () => {
    const config = configFor("CLEAN");
    const next = withKnob(config, "crt", "scan", 0.9);
    expect(next.crt).toEqual({ ...config.crt, scan: 0.9 });
  });

  it("leaves the input untouched and shares the other effects' objects", () => {
    const config = configFor("CLEAN");
    const before = structuredClone(config);
    const next = withKnob(config, "crt", "on", 0);
    expect(config).toEqual(before);
    expect(next).not.toBe(config);
    expect(next.crt).not.toBe(config.crt);
    expect(next.chroma).toBe(config.chroma);
  });
});
