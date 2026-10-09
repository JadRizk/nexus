#!/usr/bin/env node
// Regenerates every raster in the brand kit from its SVG source, then copies
// the files the showcase serves into apps/showcase/public/.
//
// SVG is the source; PNG is build output, committed because GitHub, iOS and
// every crawler take raster only. Run this after any SVG edit, in the same
// commit, so no PNG goes stale beside the SVG it was rendered from.
//
// Needs the resvg CLI (`brew install resvg`, or `cargo install resvg`). Not
// ImageMagick: without rsvg-convert it falls back to its own SVG renderer,
// which once turned a 1200×630 card into 737 bytes of 1-bit greyscale.
//
// The .ico is packed here, PNG-in-ICO, with no dependency.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = join(root, "brand/assets");
const publicDir = join(root, "apps/showcase/public");

try {
  execFileSync("resvg", ["--version"], { stdio: "ignore" });
} catch {
  console.error("brand-assets: resvg not found. Install it: brew install resvg");
  process.exit(1);
}

/** [source svg, output png, width, height] — all under brand/assets/. */
const RENDERS = [
  ["logo/mark.svg", "logo/apple-touch-icon.png", 180, 180],
  ["logo/mark.svg", "logo/icon-192.png", 192, 192],
  ["logo/mark.svg", "logo/icon-512.png", 512, 512],
  ["logo/icon-maskable.svg", "logo/icon-maskable-512.png", 512, 512],
  ["social/social-card.svg", "social/social-card.png", 1200, 630],
  ["social/github-card.svg", "social/github-card.png", 1280, 640],
  ["readme-header.svg", "readme-header.png", 1280, 320],
];
// Sizes of 48 and under carry the small mark, never the full one.
const ICO_SIZES = [16, 32, 48];

const render = (src, dst, w, h) =>
  execFileSync("resvg", ["-w", String(w), "-h", String(h), join(assets, src), dst]);

for (const [src, out, w, h] of RENDERS) {
  render(src, join(assets, out), w, h);
  console.log(`rendered brand/assets/${out} (${w}x${h})`);
}

// favicon.ico: one PNG per size, each in its own directory entry.
{
  const tmp = join(assets, "logo/.ico-tmp");
  mkdirSync(tmp, { recursive: true });
  const pngs = ICO_SIZES.map((s) => {
    const p = join(tmp, `${s}.png`);
    render("logo/favicon.svg", p, s, s);
    return readFileSync(p);
  });
  rmSync(tmp, { recursive: true });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(ICO_SIZES[i] % 256, 0); // width; 0 means 256
    e.writeUInt8(ICO_SIZES[i] % 256, 1); // height
    e.writeUInt8(0, 2); // palette size
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  });
  writeFileSync(join(assets, "logo/favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
  console.log(`packed brand/assets/logo/favicon.ico (${ICO_SIZES.join("/")})`);
}

// What the showcase serves. Vite copies public/ to the site root unchanged.
const PUBLIC = [
  ["logo/favicon.ico", "favicon.ico"],
  ["logo/favicon.svg", "favicon.svg"],
  ["logo/apple-touch-icon.png", "apple-touch-icon.png"],
  ["logo/icon-192.png", "icon-192.png"],
  ["logo/icon-512.png", "icon-512.png"],
  ["logo/icon-maskable-512.png", "icon-maskable-512.png"],
  ["social/social-card.png", "og.png"],
];
mkdirSync(publicDir, { recursive: true });
for (const [from, to] of PUBLIC) {
  copyFileSync(join(assets, from), join(publicDir, to));
  console.log(`copied apps/showcase/public/${to}`);
}
