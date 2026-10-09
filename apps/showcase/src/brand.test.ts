/// <reference types="node" />
// Node types for this file only: the app itself runs in the browser.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* ============================================================================
   The brand kit copies colours out of the token system, because the places it
   lands cannot read a custom property: the manifest is read by the OS, the
   theme-color by the browser chrome, the favicon and the social card by
   crawlers. Each copy is a fact pinned here, so a token change that is not
   carried into the kit fails a test rather than shipping two greens.
   ========================================================================== */

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const text = (path: string) => readFileSync(repo(path), "utf8");

const tokens = JSON.parse(text("packages/tokens/src/tokens.json"));
const VOID: string = tokens.primitive.colour.void.$value;
const TOKEN_HEX = new Set(
  [
    ...Object.values(tokens.primitive.colour as Record<string, { $value: string }>),
    ...Object.values(tokens.primitive.ramp as Record<string, { $value: string }>),
  ]
    .map((t) => t.$value)
    .filter((v) => typeof v === "string" && v.startsWith("#"))
    .map((v) => v.toUpperCase()),
);

const html = text("apps/showcase/index.html");
const manifest = JSON.parse(text("apps/showcase/public/site.webmanifest"));

function meta(attr: "name" | "property", key: string): string | undefined {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`);
  return html.replace(/\s+/g, " ").match(re)?.[1];
}

describe("brand metadata", () => {
  it("copies the page ground into theme-color and both manifest colours", () => {
    expect(meta("name", "theme-color")).toBe(VOID);
    expect(manifest.theme_color).toBe(VOID);
    expect(manifest.background_color).toBe(VOID);
  });

  it("gives crawlers absolute https URLs, since they reject relative ones", () => {
    for (const [attr, key] of [
      ["property", "og:image"],
      ["property", "og:url"],
      ["name", "twitter:image"],
    ] as const) {
      expect(meta(attr, key), key).toMatch(/^https:\/\//);
    }
  });
});

describe("brand assets", () => {
  // The shipped sources. The refused candidates in brand/assets/logo/ are a
  // record, drawn once, and deliberately not held to this.
  const SHIPPED = [
    "logo/mark.svg",
    "logo/mark-inverted.svg",
    "logo/favicon.svg",
    "logo/icon-maskable.svg",
    "logo/wordmark.svg",
    "social/social-card.svg",
    "social/github-card.svg",
    "readme-header.svg",
  ];

  it.each(SHIPPED)("%s uses only token colours", (file) => {
    const hex = text(`brand/assets/${file}`).match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
    expect(hex.length, "no colours found — has the drawing changed shape?").toBeGreaterThan(0);
    for (const h of hex) expect(TOKEN_HEX, `${h} in ${file}`).toContain(h.toUpperCase());
  });

  it.each([
    ["logo/favicon.svg", "favicon.svg"],
    ["logo/favicon.ico", "favicon.ico"],
    ["logo/apple-touch-icon.png", "apple-touch-icon.png"],
    ["social/social-card.png", "og.png"],
  ])("serves brand/assets/%s unchanged as public/%s", (from, to) => {
    const a = readFileSync(repo(`brand/assets/${from}`));
    const b = readFileSync(repo(`apps/showcase/public/${to}`));
    expect(b.equals(a), "run node scripts/brand-assets.mjs").toBe(true);
  });
});
