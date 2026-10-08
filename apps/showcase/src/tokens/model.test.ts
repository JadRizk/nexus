/// <reference types="node" />
// Node types for this file only: the app itself runs in the browser.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { accessorOf, contrastOf, parseComponentCss, tokenByName, TOKENS } from "./model.js";

const generatedCss = readFileSync(
  fileURLToPath(new URL("../../../../packages/tokens/src/tokens.css", import.meta.url)),
  "utf8",
);

describe("token model", () => {
  it("names exactly the custom properties the token build emits", () => {
    // The page's naming mirrors build-tokens.mjs; this is what keeps them in
    // step. A token missing here would be absent from the page, and a name
    // here that the CSS lacks would be a swatch for a variable that is not set.
    const emitted = new Set(
      Array.from(generatedCss.matchAll(/^\s*(--nx-[a-z0-9-]+)\s*:/gm), (m) => m[1]),
    );
    expect(new Set(TOKENS.map((t) => t.name))).toEqual(emitted);
    expect(TOKENS).toHaveLength(emitted.size);
  });

  it("resolves aliases per theme", () => {
    const disabled = tokenByName("--nx-fg-disabled")!;
    expect(disabled.alias).toBe("--nx-grey-300");
    expect(disabled.values).toEqual({ "hud-aa": "#6F8465", hud: "#3D4C39" });
    expect(disabled.themed).toBe(true);
    expect(tokenByName("--nx-fg-accent")!.themed).toBe(false);
  });

  it("computes rendered type sizes through the theme's font scale", () => {
    const xs = tokenByName("--nx-text-xs")!;
    expect(xs.px!["hud"]).toBe(10);
    expect(xs.px!["hud-aa"]).toBeCloseTo(11.5);
    expect(xs.themed).toBe(true);
  });

  it("reads contrast through the alias chain", () => {
    const disabled = tokenByName("--nx-fg-disabled")!;
    expect(contrastOf(disabled, "hud-aa")).toBe(4.82);
    expect(contrastOf(tokenByName("--nx-bg-hover")!, "hud-aa")).toBeUndefined();
  });

  it("records which tokens alias a primitive", () => {
    expect(tokenByName("--nx-lime")!.referencedBy).toEqual(["--nx-fg-cat-lime"]);
  });

  it("names the typed accessor where the package exports one", () => {
    expect(accessorOf(tokenByName("--nx-fg-critical")!)).toBe('tone("critical")');
    expect(accessorOf(tokenByName("--nx-space-4")!)).toBe("space(4)");
    expect(accessorOf(tokenByName("--nx-dur-panel")!)).toBe('duration("panel")');
    expect(accessorOf(tokenByName("--nx-glow-raised")!)).toBe("elevation.raised");
    expect(accessorOf(tokenByName("--nx-acid")!)).toBeUndefined();
  });
});

describe("component layer", () => {
  it("separates a component's own hooks from the global tokens it reads", () => {
    const layer = parseComponentCss({
      "components/Button/Button.css": `
        /* var(--nx-commented-out, red) */
        .nx-btn { color: var(--nx-btn-fg, var(--nx-fg-muted));
                  padding: var(--nx-btn-padding, var(--nx-space-3) var(--nx-space-4)); }
        .nx-btn:hover { --nx-btn-fg: var(--nx-fg-accent); }`,
    });
    expect(layer.hooks.get("Button")).toEqual([
      { name: "--nx-btn-fg", fallback: "var(--nx-fg-muted)" },
      { name: "--nx-btn-padding", fallback: "var(--nx-space-3) var(--nx-space-4)" },
    ]);
    expect(layer.usedBy.get("--nx-fg-accent")).toEqual(["Button"]);
    expect(layer.usedBy.get("--nx-space-4")).toEqual(["Button"]);
  });

  it("finds hooks in the real component stylesheets", () => {
    // Read from disk rather than through componentCss.ts: Vitest stubs CSS
    // imports to empty strings, ?raw included. The glob itself is exercised
    // by the browser suite, which renders the real page.
    const dir = fileURLToPath(
      new URL("../../../../packages/react/src/components/", import.meta.url),
    );
    const files = Object.fromEntries(
      readdirSync(dir, { recursive: true, encoding: "utf8" })
        .filter((f) => f.endsWith(".css"))
        .map((f) => [`components/${f}`, readFileSync(dir + f, "utf8")]),
    );
    const layer = parseComponentCss(files);
    expect(layer.hooks.size).toBeGreaterThan(10);
    expect(layer.hooks.get("Button")?.map((h) => h.name)).toContain("--nx-btn-fg");
    expect(layer.usedBy.get("--nx-fg-accent")).toContain("Button");
  });
});
