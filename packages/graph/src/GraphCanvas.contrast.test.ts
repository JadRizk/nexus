import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* ============================================================================
   Tooltip secondary-text contrast.

   The tooltip's secondary span (category code + degree, set in showTip()
   inside GraphCanvas.tsx's boot()) is only reachable at runtime through a
   real WebGL mount — nothing this workspace's vitest/jsdom setup can do
   without a GPU (see GraphCanvas.a11y.test.tsx). What CAN be pinned here is
   the number itself: the colour is a literal in GraphCanvas.tsx, the
   tooltip's background is a literal too (`rgba(8,10,9,.95)`), and the worst
   case it sits over is a node rendered at its brightest configured colour —
   all three are known without a browser, so the contrast ratio the tooltip
   will actually show is computable, not just assertable-by-eyeball.

   This package deliberately has no runtime dependency on
   @nexus-cyberdeck/tokens (FALLBACK_BG/FALLBACK_FG in GraphCanvas.tsx are
   the same story), so the WCAG relative-luminance/contrast-ratio maths is
   reproduced here rather than imported — mirroring
   packages/tokens/lib/wcag.mjs exactly (same formulas, same source:
   https://www.w3.org/TR/WCAG22/#dfn-relative-luminance /
   #dfn-contrast-ratio) rather than trusting a transcription of the number.
   ========================================================================== */

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not an opaque hex colour: "${hex}"`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composites `fg` (with `alpha`, 0-1) over an opaque `bg`. */
function compositeOver(fg: RGB, alpha: number, bg: RGB): RGB {
  return fg.map((c, i) => c * alpha + bg[i]! * (1 - alpha)) as RGB;
}

// Both literals are read out of GraphCanvas.tsx rather than restated here, so
// this file measures the colour that actually ships: reinstating #6B7F61 (or
// any other value) in showTip() fails the floor assertion below instead of
// leaving a test that only ever checked its own constants.
const SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "GraphCanvas.tsx"), "utf8");

function literal(re: RegExp, what: string): string {
  const m = SOURCE.match(re);
  if (!m?.[1]) throw new Error(`${what} not found in GraphCanvas.tsx — the regex in this test needs updating alongside showTip()`);
  return m[1];
}

/** The secondary span's colour, from showTip(): `b.style.color = "#xxxxxx"`. */
const SHIPPED_TEXT_HEX = literal(/b\.style\.color = "(#[0-9a-fA-F]{6})"/, "tooltip secondary-text colour");

// The tooltip panel's own background, from `tip.style.cssText`: rgba(r,g,b,a).
const [, r, g, b, a] = literal(
  /tip\.style\.cssText =[\s\S]*?background:(rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\))/,
  "tooltip background",
).match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/)!;
const TOOLTIP_BG: RGB = [Number(r), Number(g), Number(b)];
const TOOLTIP_ALPHA = Number(a);

// The canvas's own resting background (FALLBACK_BG / the tooltip's least
// bright possible ground) and the brightest sample node colour in this
// workspace's fixtures (GraphCanvas.physics.test.tsx's "atlas" category),
// standing in for "as bright as a node in this package is ever configured
// to render" — the worst case a translucent tooltip can be composited over.
const CANVAS_DARK_GROUND: RGB = parseHex("#08090A");
const BRIGHT_NODE_GROUND: RGB = parseHex("#9EFF3D");

const AA_TEXT_FLOOR = 4.5;

/** The tooltip's actual on-screen ground: its own translucent panel over whatever the canvas is drawing beneath it. */
function tooltipGroundOver(behind: RGB): RGB {
  return compositeOver(TOOLTIP_BG, TOOLTIP_ALPHA, behind);
}

function tooltipTextContrast(textHex: string, behind: RGB): number {
  return contrastRatio(parseHex(textHex), tooltipGroundOver(behind));
}

describe("tooltip secondary-text contrast (composited, worst case)", () => {
  it("computes the WCAG formula the way packages/tokens/lib/wcag.mjs does", () => {
    // Sanity-check the reproduction against a known pair before trusting it
    // for the colours below: pure black on pure white is exactly 21:1.
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
  });

  it("the shipped colour meets the 4.5 AA floor even over the brightest node", () => {
    expect(SHIPPED_TEXT_HEX.toUpperCase()).toBe("#6F8465"); // NX-16 grey-300
    const worstCase = tooltipTextContrast(SHIPPED_TEXT_HEX, BRIGHT_NODE_GROUND);
    expect(worstCase).toBeGreaterThanOrEqual(AA_TEXT_FLOOR);
    // Pinned to the measured value (see GraphCanvas.tsx's showTip comment)
    // so a future colour change that happens to still clear 4.5 is still
    // visible in the diff, not just silently passing.
    expect(worstCase).toBeCloseTo(4.5184, 3);
  });

  it("also clears the floor over the flat dark canvas background", () => {
    expect(tooltipTextContrast(SHIPPED_TEXT_HEX, CANVAS_DARK_GROUND)).toBeGreaterThanOrEqual(AA_TEXT_FLOOR);
  });

  it("regression: fails if the PR #14 colour (#6B7F61) is reinstated", () => {
    // #6B7F61 is grey-300 from before NX-16 raised the ramp; it clears 4.5
    // over a flat dark ground but misses it over a bright node, which is
    // the tooltip's actual worst case.
    const worstCase = tooltipTextContrast("#6B7F61", BRIGHT_NODE_GROUND);
    expect(worstCase).toBeCloseTo(4.2289, 3);
    expect(worstCase).toBeLessThan(AA_TEXT_FLOOR);
  });

  it("regression: fails if the original #3D4C39 is reinstated", () => {
    const ratio = tooltipTextContrast("#3D4C39", CANVAS_DARK_GROUND);
    expect(ratio).toBeCloseTo(2.1667, 3);
    expect(ratio).toBeLessThan(AA_TEXT_FLOOR);
  });
});
