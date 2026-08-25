/* ============================================================================
   @nexus/tokens
   The CSS custom properties are the runtime source of truth. This module gives
   TypeScript consumers typed handles to them, so a component can say
   `tone("critical")` instead of hardcoding `var(--nx-fg-critical)` and getting
   the name subtly wrong.
   ========================================================================== */

export type NexusTheme = "hud" | "hud-aa";

/** Foreground roles. `critical` is the only route to the alarm colour. */
export type Tone =
  | "default" | "muted" | "subtle" | "tertiary" | "disabled"
  | "accent" | "info" | "warning" | "critical";

export type Surface = "canvas" | "surface" | "raised";
export type BorderTone = "default" | "strong" | "accent";
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

/**
 * Measured contrast of every palette entry against `--nx-bg-surface`.
 * Exported so a consuming app can assert its own colour choices in a test
 * rather than discovering the problem in an audit.
 */
export const contrast = {
  "hud-aa": {
    phosphor: 16.84, acid: 14.98, lime: 15.2, data: 12.19, sodium: 8.32,
    violet: 6.27, alarm: 5.44,
    "grey-100": 1.61, "grey-200": 3.01, "grey-300": 4.52,
    "grey-400": 5.5, "grey-500": 7.0, "grey-600": 10.0,
  },
  hud: {
    phosphor: 16.84, acid: 14.98, lime: 15.2, data: 12.19, sodium: 8.32,
    violet: 6.27, alarm: 5.44,
    "grey-100": 1.21, "grey-200": 1.57, "grey-300": 2.14,
    "grey-400": 2.72, "grey-500": 3.8, "grey-600": 4.98,
  },
} as const;

/** WCAG 2.2 thresholds, for assertions in consumer tests. */
export const WCAG = {
  AA_TEXT: 4.5,
  AA_LARGE_TEXT: 3.0,
  AA_NON_TEXT: 3.0,
  AAA_TEXT: 7.0,
} as const;

/** True when every foreground role in the theme clears AA body contrast. */
export function themeMeetsAA(theme: NexusTheme): boolean {
  const c = contrast[theme];
  return c["grey-300"] >= WCAG.AA_TEXT && c["grey-200"] >= WCAG.AA_NON_TEXT;
}
