/* ============================================================================
   WCAG 2.2 contrast, computed rather than transcribed.

   Relative luminance and contrast ratio exactly as defined in WCAG 2.2:
     https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
     https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

   Deliberately dependency-free: this runs in the tokens build, and a colour
   library is a lot of surface area to trust with the one number the whole
   accessibility claim rests on.
   ========================================================================== */

/** `#RGB` or `#RRGGBB` → `[r, g, b]`, each 0–255. */
export function parseHex(hex) {
  const h = String(hex).trim().replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not an opaque hex colour: "${hex}"`);
  }
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/**
 * WCAG relative luminance.
 *
 * The knee is 0.04045, the value WCAG 2.2 gives. Older copies of the formula
 * (WCAG 2.0's original text, and most code copied from it) use 0.03928, which
 * is where the linear segment and the power segment actually meet; 0.04045 is
 * the sRGB specification's own rounded figure and is what the current
 * normative text says. For 8-bit channels the choice is inert either way —
 * the two only disagree for `c` in [0.03928, 0.04045], which is `v` in
 * (10.0, 10.3), and there is no integer in there. It is changed here so the
 * code reads as the spec reads rather than as the spec used to read.
 */
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two opaque colours, 1–21. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Rounded the way the ratio is quoted in documentation and audits. */
export const ratio2 = (a, b) => Math.round(contrastRatio(a, b) * 100) / 100;
