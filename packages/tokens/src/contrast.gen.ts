/* ============================================================================
   GENERATED FILE — do not edit.

   Produced from src/tokens.json by packages/tokens/build-tokens.mjs.
   Edit the token source and run `npm run build:tokens`.
   ========================================================================== */

export type NexusTheme = "hud-aa" | "hud";

/**
 * Contrast of every palette entry against `--nx-bg-surface` (#0A0C0B),
 * computed from the resolved token values at build time.
 *
 * Exported so a consuming app can assert its own colour choices in a test
 * rather than discovering the problem in an audit.
 */
export const contrast = {
  "hud-aa": {
    acid: 14.98,
    data: 12.19,
    lime: 15.2,
    sodium: 8.32,
    violet: 6.27,
    phosphor: 16.84,
    alarm: 5.44,
    "grey-100": 1.61,
    "grey-200": 3.19,
    "grey-300": 4.82,
    "grey-400": 5.5,
    "grey-500": 7,
    "grey-600": 10,
  },
  "hud": {
    acid: 14.98,
    data: 12.19,
    lime: 15.2,
    sodium: 8.32,
    violet: 6.27,
    phosphor: 16.84,
    alarm: 5.44,
    "grey-100": 1.21,
    "grey-200": 1.57,
    "grey-300": 2.14,
    "grey-400": 2.72,
    "grey-500": 3.8,
    "grey-600": 4.98,
  },
} as const;

/** The AA floors each theme declares for itself in tokens.json. */
export const themeTargets = {
  "hud-aa": { text: 4.5, nonText: 3 },
} as const;
