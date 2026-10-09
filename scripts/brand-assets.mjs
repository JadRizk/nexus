#!/usr/bin/env node
// Regenerates every raster in the brand kit from its SVG source, copies the
// files the showcase serves into apps/showcase/public/, and redraws the 16px
// evidence sheet in brand/references/.
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
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES } from "./brand-meta.mjs";

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
  execFileSync("resvg", ["-w", String(w), "-h", String(h), src, dst]);
const tmp = mkdtempSync(join(tmpdir(), "nx-brand-"));

try {
  for (const [src, out, w, h] of RENDERS) {
    render(join(assets, src), join(assets, out), w, h);
    console.log(`rendered brand/assets/${out} (${w}x${h})`);
  }

  // favicon.ico: one PNG per size, each in its own directory entry.
  const pngs = ICO_SIZES.map((s) => {
    const p = join(tmp, `ico-${s}.png`);
    render(join(assets, "logo/favicon.svg"), p, s, s);
    return readFileSync(p);
  });
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

  // What the showcase serves. Vite copies public/ to the site root unchanged.
  mkdirSync(publicDir, { recursive: true });
  for (const [from, to] of PUBLIC_FILES) {
    copyFileSync(join(assets, from), join(publicDir, to));
    console.log(`copied apps/showcase/public/${to}`);
  }

  readSheet();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

/**
 * brand/references/mark-16px-read.png: the shipped marks rendered at 16, 32
 * and 64 device pixels by resvg, then laid out on a light and a dark tab colour
 * and magnified with nearest-neighbour, so the 16px row shows the real pixels
 * rather than a scaled vector. This is the evidence the small mark was chosen
 * on, so it is rebuilt with every other raster.
 */
function readSheet() {
  const marks = ["favicon.svg", "mark.svg", "icon-maskable.svg"];
  const sizes = [16, 32, 64];
  const magnify = { 16: 4, 32: 2, 64: 1 }; // every cell shows 64 px
  const tabs = [
    ["light tab", "#FFFFFF", "#1F1F1F"],
    ["dark tab", "#202124", "#E8EAED"],
  ];
  const cell = 64 + 24;
  const labelW = 170;
  const rowH = 64 + 28;
  const colW = sizes.length * cell + 16;
  const W = labelW + tabs.length * colW + 16;
  const H = 88 + marks.length * rowH + 8;
  const font = `font-family="Menlo, DejaVu Sans Mono, monospace" font-size="13"`;
  const parts = [`<rect width="${W}" height="${H}" fill="#2A2A2A"/>`];
  parts.push(
    `<text x="16" y="28" ${font} fill="#EDEDED">16 px shown ×4 · 32 px ×2 · 64 px ×1, nearest-neighbour</text>`,
  );
  tabs.forEach(([label, bg, fg], ti) => {
    const x = labelW + ti * colW;
    parts.push(`<rect x="${x}" y="40" width="${colW - 8}" height="${H - 48}" fill="${bg}"/>`);
    parts.push(`<text x="${x + 12}" y="64" ${font} fill="${fg}">${label}</text>`);
  });
  marks.forEach((name, ri) => {
    const y = 80 + ri * rowH;
    parts.push(
      `<text x="16" y="${y + 38}" ${font} fill="#EDEDED">${name.replace(/\.svg$/, "")}</text>`,
    );
    tabs.forEach((_, ti) => {
      sizes.forEach((s, si) => {
        const png = join(tmp, `read-${name}-${s}.png`);
        render(join(assets, "logo", name), png, s, s);
        const href = `data:image/png;base64,${readFileSync(png).toString("base64")}`;
        const x = labelW + ti * colW + 12 + si * cell;
        const px = s * magnify[s];
        parts.push(
          `<image x="${x}" y="${y}" width="${px}" height="${px}" image-rendering="optimizeSpeed" href="${href}"/>`,
        );
      });
    });
  });
  const sheet = join(tmp, "read.svg");
  writeFileSync(
    sheet,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`,
  );
  const out = join(root, "brand/references/mark-16px-read.png");
  execFileSync("resvg", [sheet, out]);
  console.log("rendered brand/references/mark-16px-read.png");
}
