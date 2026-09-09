/* ============================================================================
   @nexus-cyberdeck/tokens

   tokens.json is the source of truth. Both tokens.css and contrast.gen.ts are
   generated from it — see packages/tokens/build-tokens.mjs.

   This module is the hand-written part: typed handles to the custom properties
   so a component can say `tone("critical")` instead of hardcoding
   `var(--nx-fg-critical)` and getting the name subtly wrong.
   ========================================================================== */

export { contrast, themeTargets } from "./contrast.gen.js";
export type { NexusTheme } from "./contrast.gen.js";

import { contrast, themeTargets } from "./contrast.gen.js";
import type { NexusTheme } from "./contrast.gen.js";

/**
 * Foreground roles. `critical` is the only route to the alarm colour;
 * `cat-lime` and `cat-violet` are categorical slots that carry no status
 * meaning of their own.
 *
 * Kept as a runtime array so index.test.ts can diff it against
 * `semantic.fg` in tokens.json — a role added to the JSON without a matching
 * entry here fails that test rather than silently having no typed handle.
 */
export const TONES = [
  "default", "muted", "subtle", "tertiary", "disabled",
  "accent", "info", "warning", "critical", "cat-lime", "cat-violet",
] as const;
export type Tone = (typeof TONES)[number];

/** Background roles. See TONES for why this is an array, not a bare union. */
export const SURFACES = ["canvas", "surface", "raised", "hover", "active", "track"] as const;
export type Surface = (typeof SURFACES)[number];

/** Border roles. See TONES for why this is an array, not a bare union. */
export const BORDER_TONES = ["default", "strong", "accent"] as const;
export type BorderTone = (typeof BORDER_TONES)[number];

export type SpaceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type TextSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl";
export type Tracking = "tight" | "normal" | "wide" | "wider";
export type Duration = "micro" | "fade" | "panel";

/** `tone("critical")` → `"var(--nx-fg-critical)"` */
export const tone = (t: Tone): string => `var(--nx-fg-${t})`;
export const surface = (s: Surface): string => `var(--nx-bg-${s})`;
export const border = (b: BorderTone): string => `var(--nx-border-${b})`;
export const space = (s: SpaceStep): string => `var(--nx-space-${s})`;
export const text = (s: TextSize): string => `var(--nx-text-${s})`;
export const track = (t: Tracking): string => `var(--nx-track-${t})`;
export const duration = (d: Duration): string => `var(--nx-dur-${d})`;

export const font = {
  mono: "var(--nx-font-mono)",
  stencil: "var(--nx-font-stencil)",
} as const;

export const motion = {
  ease: "var(--nx-ease)",
  blink: "var(--nx-blink)",
} as const;

export const elevation = {
  inset: "var(--nx-glow-inset)",
  raised: "var(--nx-glow-raised)",
} as const;

export const shape = {
  hairline: "var(--nx-hairline)",
  radius: "var(--nx-radius)",
  tick: "var(--nx-tick)",
} as const;

/** WCAG 2.2 thresholds, for assertions in consumer tests. */
export const WCAG = {
  AA_TEXT: 4.5,
  AA_LARGE_TEXT: 3.0,
  AA_NON_TEXT: 3.0,
  AAA_TEXT: 7.0,
} as const;

/**
 * True when the theme clears the contrast floors it declares for itself.
 *
 * Both the ratios and the floors are generated from tokens.json, and the token
 * build already fails if a theme misses its own targets — so this is the
 * runtime echo of a guarantee that is enforced at build time, not the only
 * thing standing between a colour change and a shipped accessibility bug.
 *
 * A theme with no declared targets (`hud`) is not AA and returns false.
 */
export function themeMeetsAA(theme: NexusTheme): boolean {
  const targets = (themeTargets as Record<string, { text: number; nonText: number } | undefined>)[
    theme
  ];
  if (!targets) return false;
  const c = contrast[theme];
  return c["grey-300"] >= targets.text && c["grey-200"] >= targets.nonText;
}
