#!/usr/bin/env node
// Draws the SVG sources of the brand kit into brand/assets/: the mark, its
// mono and inverted versions, the 16px favicon drawing, the maskable icon,
// the wordmark, both social cards and the README header.
//
// Every string and colour comes from scripts/brand-meta.mjs, which reads the
// colours from packages/tokens/src/tokens.json, so the kit follows a token or
// positioning change on the next run instead of drifting from it. Text is
// outlined to paths here, so the SVGs render identically on every machine and
// in every crawler without the fonts installed.
//
// Run this after changing the mark, the tagline or a colour; then run
// `node scripts/brand-assets.mjs` to regenerate the rasters. Both outputs are
// committed. The refused mark candidates in brand/assets/logo/ are not drawn
// here: they are a record, not build output.
//
// Needs two things the repository does not carry:
//   - opentype.js and the DejaVu fonts, installed outside the repository so the
//     workspace's node_modules and lockfile are untouched:
//       D=$(mktemp -d) && npm install --prefix "$D" --no-save opentype.js@1.3.4 dejavu-fonts-ttf@2.37.3
//       NODE_PATH="$D/node_modules" node scripts/brand-draw.mjs
//   - Impact, the stencil face. macOS ships it at the default path below;
//     elsewhere set NX_IMPACT_TTF to a copy of Impact.ttf.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, COLOURS } from "./brand-meta.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);

function load(name) {
  try {
    return require(name);
  } catch {
    console.error(
      `brand-draw: cannot load ${name}. Install the drawing dependencies outside the repo\n` +
        "and point NODE_PATH at them:\n\n" +
        '  D=$(mktemp -d) && npm install --prefix "$D" --no-save opentype.js@1.3.4 dejavu-fonts-ttf@2.37.3\n' +
        '  NODE_PATH="$D/node_modules" node scripts/brand-draw.mjs',
    );
    process.exit(1);
  }
}
const opentype = load("opentype.js");
const IMPACT = process.env.NX_IMPACT_TTF ?? "/System/Library/Fonts/Supplemental/Impact.ttf";
if (!existsSync(IMPACT)) {
  console.error(`brand-draw: no Impact at ${IMPACT}. Set NX_IMPACT_TTF to Impact.ttf.`);
  process.exit(1);
}
const dejavu = dirname(require.resolve("dejavu-fonts-ttf/package.json"));
const stencil = opentype.loadSync(IMPACT);
const mono = opentype.loadSync(join(dejavu, "ttf/DejaVuSansMono.ttf"));
const monoBold = opentype.loadSync(join(dejavu, "ttf/DejaVuSansMono-Bold.ttf"));

// ── colours and strings, from scripts/brand-meta.mjs ─────────────────────────
const VOID = COLOURS.ground;
const PHOSPHOR = COLOURS.ink;
const ACID = COLOURS.signal;
const LABEL = COLOURS.label; // fg.tertiary — 5.59:1 on void
const QUIET = COLOURS.quiet; // fg.subtle — 7.11:1 on void
const NAME = BRAND.name;
const TAGLINE = BRAND.tagline;
// Card-only copy, so it lives with the card.
const EYEBROW = "/// hud design system for react";
const FOOTER = "@nexus-cyberdeck/tokens · react · graph";
const SHEAR = Math.tan((9 * Math.PI) / 180); // the Wordmark component's skewX(-9deg)
const CAP = 0.791; // Impact's cap height per em

// ── path helpers ─────────────────────────────────────────────────────────────
const POINTS = [
  ["x", "y"],
  ["x1", "y1"],
  ["x2", "y2"],
];
/** Lean a path's tops right by 9°, pivoting on y = pivot. */
function shear(path, pivot) {
  for (const c of path.commands)
    for (const [kx, ky] of POINTS) if (c[kx] !== undefined) c[kx] += SHEAR * (pivot - c[ky]);
  return path;
}
function move(path, dx, dy) {
  for (const c of path.commands)
    for (const [kx, ky] of POINTS)
      if (c[kx] !== undefined) {
        c[kx] += dx;
        c[ky] += dy;
      }
  return path;
}
const fmt = (n) => +n.toFixed(2);
const rect = (x, y, w, h, fill, extra = "") =>
  `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${fill}"${extra}/>`;
function svg(w, h, body, label) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">\n` +
    `<title>${label}</title>\n${body}\n</svg>\n`
  );
}

/** The stencil N, sheared, centred in a square of side `tile` at cap height `cap`. */
function markN(tile, cap) {
  const p = shear(stencil.charToGlyph("N").getPath(0, 0, cap / CAP), -cap / 2);
  const b = p.getBoundingBox();
  return move(p, tile / 2 - (b.x1 + b.x2) / 2, tile / 2 - (b.y1 + b.y2) / 2).toPathData(3);
}

/**
 * NEXUS CYBERDECK in the stencil face: cap height `cap`, tracking −0.02em,
 * sheared about the baseline. Returns the ink box's size and `place(x, y)`,
 * which puts the ink's top-left at (x, y) and returns the path data. Laid out
 * once; place it once.
 */
function wordmark(cap) {
  const size = cap / CAP;
  const scale = size / stencil.unitsPerEm;
  const glyphs = stencil.stringToGlyphs(NAME.toUpperCase());
  const paths = [];
  let pen = 0;
  glyphs.forEach((g, i) => {
    paths.push(shear(g.getPath(pen, 0, size), 0));
    const next = glyphs[i + 1];
    pen += g.advanceWidth * scale + (next ? stencil.getKerningValue(g, next) * scale : 0);
    pen -= 0.02 * size;
  });
  const inked = paths.filter((p) => p.commands.length);
  const boxes = inked.map((p) => p.getBoundingBox());
  const x1 = Math.min(...boxes.map((b) => b.x1));
  const y1 = Math.min(...boxes.map((b) => b.y1));
  const w = Math.max(...boxes.map((b) => b.x2)) - x1;
  const h = Math.max(...boxes.map((b) => b.y2)) - y1;
  const place = (x, y) => inked.map((p) => move(p, x - x1, y - y1).toPathData(2)).join(" ");
  return { w, h, place };
}

/** Mono text outlined, left edge at x, baseline at y, as path data. Tracking in em. */
function text(str, x, y, size, { bold = false, tracking = 0 } = {}) {
  const font = bold ? monoBold : mono;
  const scale = size / font.unitsPerEm;
  const parts = [];
  let pen = x;
  for (const g of font.stringToGlyphs(str)) {
    const p = g.getPath(pen, y, size);
    if (p.commands.length) parts.push(p.toPathData(2));
    pen += g.advanceWidth * scale + tracking * size;
  }
  return parts.join(" ");
}
const advance = (str, size, tracking = 0) =>
  str.length * (mono.charToGlyph("M").advanceWidth / mono.unitsPerEm) * size +
  (str.length - 1) * tracking * size;

/** Corner ticks — the Panel's tl + br default — framing a w × h canvas. */
function ticks(w, h, inset, arm, weight) {
  const far = (n) => n - inset;
  return [
    rect(inset, inset, arm, weight, ACID),
    rect(inset, inset, weight, arm, ACID),
    rect(far(w) - arm, far(h) - weight, arm, weight, ACID),
    rect(far(w) - weight, far(h) - arm, weight, arm, ACID),
  ].join("\n");
}

/** The HazardRule: acid stripes at −45°, 4 on 5 off, at 32% opacity. */
function hazard(x, y, w, h, id) {
  return (
    `<defs><pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="4" height="9" fill="${ACID}"/></pattern></defs>\n` +
    rect(x, y, w, h, `url(#${id})`, ` opacity="0.32"`)
  );
}

// ── the card: one composition at any size, everything load-bearing inside the
//    centre 66% ────────────────────────────────────────────────────────────────
function card(W, H, { eyebrow = true, footer = true, cap, tag, label = 18 } = {}) {
  const mark = wordmark(cap);
  const tagW = advance(TAGLINE + " █", tag);
  const blockW = Math.max(mark.w, tagW);
  const x0 = (W - blockW) / 2;
  const gap = cap * 0.42;
  const rows = [
    eyebrow && label * 1.0,
    mark.h,
    tag * 1.0,
    6, // hazard rule
    footer && label * 1.0,
  ].filter(Boolean);
  const total = rows.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
  let y = (H - total) / 2;
  const body = [rect(0, 0, W, H, VOID), ticks(W, H, H * 0.064, H * 0.09, 3)];
  if (eyebrow) {
    const t = text(EYEBROW.toUpperCase(), x0, y + label * 0.78, label, { tracking: 0.2 });
    body.push(`<path d="${t}" fill="${LABEL}"/>`);
    y += label + gap;
  }
  body.push(`<path d="${mark.place(x0, y)}" fill="${PHOSPHOR}"/>`);
  y += mark.h + gap;
  const t = text(TAGLINE, x0, y + tag * 0.78, tag, { bold: true });
  const cursorX = x0 + advance(TAGLINE + " ", tag);
  // The BlinkCursor, still: a release surface never animates. The box is the
  // mono full block's own, 0.94em above the baseline and 0.25em below.
  const baseline = y + tag * 0.78;
  body.push(
    `<path d="${t}" fill="${PHOSPHOR}"/>`,
    rect(cursorX, baseline - tag * 0.938, tag * 0.6, tag * 1.188, ACID),
  );
  y += tag + gap;
  body.push(hazard(x0, y, blockW, 6, `hz${W}`));
  y += 6 + gap;
  if (footer) {
    const f = text(FOOTER, x0, y + label * 0.78, label, { tracking: 0.06 });
    body.push(`<path d="${f}" fill="${QUIET}"/>`);
  }
  return body.join("\n");
}

// ── write ────────────────────────────────────────────────────────────────────
const out = join(root, "brand/assets");
const files = {};
const N = (fill) => `<path d="${markN(48, 30)}" fill="${fill}"/>`;

files["logo/mark.svg"] = svg(48, 48, [rect(0, 0, 48, 48, VOID), N(PHOSPHOR)].join("\n"), NAME);
files["logo/mark-mono.svg"] = svg(48, 48, N("currentColor"), NAME);
files["logo/mark-inverted.svg"] = svg(48, 48, N(VOID), NAME);
// Android crops to its own shape; the N sits inside the centre 80% circle.
files["logo/icon-maskable.svg"] = svg(
  48,
  48,
  [rect(0, 0, 48, 48, VOID), `<path d="${markN(48, 24)}" fill="${PHOSPHOR}"/>`].join("\n"),
  NAME,
);

// The small mark: the N redrawn on the 16 grid with whole-pixel stem edges
// before the shear, because Impact's own N fills its counters at 16px.
{
  const drawn = [
    [3, 2],
    [7, 2],
    [10, 8.5],
    [10, 2],
    [13, 2],
    [13, 14],
    [9, 14],
    [6, 7.5],
    [6, 14],
    [3, 14],
  ].map(([x, y]) => `${fmt(x + SHEAR * (8 - y))},${y}`);
  files["logo/favicon.svg"] = svg(
    16,
    16,
    [rect(0, 0, 16, 16, VOID), `<polygon points="${drawn.join(" ")}" fill="${PHOSPHOR}"/>`].join(
      "\n",
    ),
    NAME,
  );
}

{
  const w = wordmark(100);
  files["logo/wordmark.svg"] = svg(
    Math.ceil(w.w),
    Math.ceil(w.h),
    `<path d="${w.place(0, 0)}" fill="${PHOSPHOR}"/>`,
    NAME,
  );
}

const cardLabel = `${NAME}: ${TAGLINE}`;
files["social/social-card.svg"] = svg(1200, 630, card(1200, 630, { cap: 72, tag: 34 }), cardLabel);
files["social/github-card.svg"] = svg(1280, 640, card(1280, 640, { cap: 76, tag: 36 }), cardLabel);
files["readme-header.svg"] = svg(
  1280,
  320,
  card(1280, 320, { cap: 64, tag: 30, footer: false, label: 16 }),
  cardLabel,
);

for (const [rel, body] of Object.entries(files)) {
  const p = join(out, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  console.log(`drew ${join("brand/assets", rel)}`);
}
