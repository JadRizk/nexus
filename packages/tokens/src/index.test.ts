import { describe, expect, it } from "vitest";
import {
  border, contrast, duration, space, surface, text, themeMeetsAA, tone, track, WCAG,
} from "./index.js";

describe("accessor functions", () => {
  it("build the expected custom-property reference", () => {
    expect(tone("critical")).toBe("var(--nx-fg-critical)");
    expect(surface("canvas")).toBe("var(--nx-bg-canvas)");
    expect(border("strong")).toBe("var(--nx-border-strong)");
    expect(space(5)).toBe("var(--nx-space-5)");
    expect(text("md")).toBe("var(--nx-text-md)");
    expect(track("wide")).toBe("var(--nx-track-wide)");
    expect(duration("panel")).toBe("var(--nx-dur-panel)");
  });

  it("space(0) is not falsy-swallowed by string interpolation", () => {
    // a naive `t ? ... : ...` accessor would mishandle 0; confirm it still builds the var name
    expect(space(0)).toBe("var(--nx-space-0)");
  });
});

describe("themeMeetsAA", () => {
  it("hud-aa clears both AA thresholds it claims to", () => {
    expect(themeMeetsAA("hud-aa")).toBe(true);
    expect(contrast["hud-aa"]["grey-300"]).toBeGreaterThanOrEqual(WCAG.AA_TEXT);
    expect(contrast["hud-aa"]["grey-200"]).toBeGreaterThanOrEqual(WCAG.AA_NON_TEXT);
  });

  it("hud (the prototype ramp) genuinely fails AA — that's the documented trade-off", () => {
    expect(themeMeetsAA("hud")).toBe(false);
    expect(contrast.hud["grey-300"]).toBeLessThan(WCAG.AA_TEXT);
  });

  it("the signature palette is identical between themes, only the muted ramp moves", () => {
    for (const key of ["phosphor", "acid", "lime", "data", "sodium", "violet", "alarm"] as const) {
      expect(contrast["hud-aa"][key]).toBe(contrast.hud[key]);
    }
  });
});
