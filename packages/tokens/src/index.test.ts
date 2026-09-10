import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  border, contrast, duration, space, surface, text,
  themeMeetsAA, tone, track, WCAG,
} from "./index.js";
// Internal, deliberately not re-exported from index.js — see roles.ts.
import { BORDER_TONES, SURFACES, TONES } from "./roles.js";

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

describe("typed unions stay in sync with tokens.json", () => {
  // Tone, Surface and BorderTone are hand-written (see roles.ts's module
  // comment on why), not generated from tokens.json the way tokens.css and
  // contrast.gen.ts are. That leaves one way for them to drift silently: a
  // semantic role added to the JSON with nobody remembering to add the
  // matching entry here. This diffs the two role by role, so that drift is a
  // failing test rather than a typed handle nobody noticed was missing.
  const here = dirname(fileURLToPath(import.meta.url));
  const tokens = JSON.parse(readFileSync(join(here, "tokens.json"), "utf8"));

  /** Role names declared under a semantic group, e.g. semantic.fg.* */
  const rolesOf = (group: Record<string, unknown>) =>
    Object.keys(group)
      .filter((k) => !k.startsWith("$"))
      .sort();

  it("Tone covers exactly the roles in semantic.fg", () => {
    expect([...TONES].sort()).toEqual(rolesOf(tokens.semantic.fg));
  });

  it("Surface covers exactly the roles in semantic.bg", () => {
    expect([...SURFACES].sort()).toEqual(rolesOf(tokens.semantic.bg));
  });

  it("BorderTone covers exactly the roles in semantic.border", () => {
    expect([...BORDER_TONES].sort()).toEqual(rolesOf(tokens.semantic.border));
  });

  it("tone(\"cat-lime\") and tone(\"cat-violet\") typecheck and resolve", () => {
    expect(tone("cat-lime")).toBe("var(--nx-fg-cat-lime)");
    expect(tone("cat-violet")).toBe("var(--nx-fg-cat-violet)");
  });

  it("surface(\"hover\"), surface(\"active\") and surface(\"track\") typecheck and resolve", () => {
    expect(surface("hover")).toBe("var(--nx-bg-hover)");
    expect(surface("active")).toBe("var(--nx-bg-active)");
    expect(surface("track")).toBe("var(--nx-bg-track)");
  });
});
