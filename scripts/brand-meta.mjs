// The brand's strings and colours, in one place, for every surface that cannot
// read a CSS custom property: the served <head>, the web app manifest, the
// browser tab title, and the SVGs scripts/brand-draw.mjs draws.
//
// The strings were decided in brand/references/positioning.md; the colours are
// read from the token source, never typed. Consumed by the showcase's Vite
// config (which fills the head, emits the manifest and defines the Home title),
// scripts/brand-draw.mjs, scripts/brand-assets.mjs and the showcase's
// brand.test.ts. Changing a string here changes it everywhere at once; the
// rasters that carry it still need `node scripts/brand-draw.mjs` and
// `node scripts/brand-assets.mjs`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tokens = JSON.parse(readFileSync(join(root, "packages/tokens/src/tokens.json"), "utf8"));

export const BRAND = {
  name: "Nexus Cyberdeck",
  /** The deployed origin and base. Every crawler-facing URL is built from it. */
  siteUrl: "https://jadrizk.github.io/nexus/",
  title: "Nexus Cyberdeck — a HUD design system for React",
  oneLiner: "A HUD design system for React, with WCAG AA enforced at build.",
  description:
    "A HUD design system for React: acid on near-black, zero radius, monospace, WCAG AA enforced at build, and a WebGL graph canvas.",
  tagline: "The HUD that passes the audit.",
  ogTitle: "Nexus Cyberdeck — the HUD that passes the audit",
  ogImageAlt:
    "The Nexus Cyberdeck wordmark in pale green stencil on near-black, above the line 'The HUD that passes the audit.' and an acid block cursor, between two corner ticks.",
  /** The home-screen label: the wordmark's capitals, allowed in tight chrome. */
  shortName: "NEXUS",
};

/** The colours the kit uses, by job. Each is a primitive's resolved hex. */
export const COLOURS = {
  ground: tokens.primitive.colour.void.$value,
  ink: tokens.primitive.colour.phosphor.$value,
  signal: tokens.primitive.colour.acid.$value,
  label: tokens.primitive.ramp["grey-400"].$value, // fg.tertiary
  quiet: tokens.primitive.ramp["grey-500"].$value, // fg.subtle
};

/** Files brand-assets.mjs serves from apps/showcase/public/: [under brand/assets/, served as]. */
export const PUBLIC_FILES = [
  ["logo/favicon.ico", "favicon.ico"],
  ["logo/favicon.svg", "favicon.svg"],
  ["logo/apple-touch-icon.png", "apple-touch-icon.png"],
  ["logo/icon-192.png", "icon-192.png"],
  ["logo/icon-512.png", "icon-512.png"],
  ["logo/icon-maskable-512.png", "icon-maskable-512.png"],
  ["social/social-card.png", "og.png"],
];

const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** `%NX_…%` placeholder → value, for the showcase's index.html. */
export const HEAD_VALUES = {
  NX_TITLE: BRAND.title,
  NX_DESCRIPTION: BRAND.description,
  NX_NAME: BRAND.name,
  NX_ONE_LINER: BRAND.oneLiner,
  NX_OG_TITLE: BRAND.ogTitle,
  NX_OG_IMAGE_ALT: BRAND.ogImageAlt,
  NX_SITE_URL: BRAND.siteUrl,
  NX_THEME_COLOR: COLOURS.ground,
};

/**
 * Fills every `%NX_…%` placeholder; throws on one it does not know. `base` is
 * the deployed base path, which only the bundler knows: the manifest is
 * generated rather than a public file, so Vite cannot prefix its link itself.
 */
export function renderHead(html, { base }) {
  const values = { ...HEAD_VALUES, NX_BASE: base };
  return html.replace(/%(NX_[A-Z_]+)%/g, (match, key) => {
    if (!(key in values)) throw new Error(`index.html: unknown placeholder ${match}`);
    return escapeAttr(values[key]);
  });
}

/**
 * The web app manifest. Relative URLs resolve against the manifest's own URL,
 * so it works at / in development and at /nexus/ on Pages. Colours are hex:
 * the OS reads this file, not the page, and cannot resolve a custom property.
 */
export function manifestJson() {
  const manifest = {
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.oneLiner,
    start_url: "./",
    scope: "./",
    display: "standalone",
    theme_color: COLOURS.ground,
    background_color: COLOURS.ground,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
