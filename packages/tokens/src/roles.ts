/* ============================================================================
   Semantic role names — internal.

   These arrays are deliberately NOT part of the package's public surface:
   index.ts imports them to derive the Tone, Surface and BorderTone unions,
   and index.test.ts imports them to diff those roles against tokens.json.
   Nothing outside packages/tokens consumes them.

   Keeping them here rather than exporting them from index.ts is a decision,
   not an oversight: adding a public export later is a non-breaking minor,
   removing one after first publish is a major. The typed handles consumers
   actually need are the `Tone`/`Surface`/`BorderTone` types and the
   `tone()`/`surface()`/`border()` accessors, all of which index.ts exports.
   ========================================================================== */

/**
 * Foreground roles. `critical` is the only route to the alarm colour;
 * `cat-lime` and `cat-violet` are categorical slots that carry no status
 * meaning of their own.
 *
 * Kept as a runtime array so index.test.ts can diff it against `semantic.fg`
 * in tokens.json — a role added to the JSON without a matching entry here
 * fails that test rather than silently having no typed handle.
 */
export const TONES = [
  "default", "muted", "subtle", "tertiary", "disabled",
  "accent", "info", "warning", "critical", "cat-lime", "cat-violet",
] as const;

/** Background roles. See TONES for why this is an array, not a bare union. */
export const SURFACES = ["canvas", "surface", "raised", "hover", "active", "track"] as const;

/** Border roles. See TONES for why this is an array, not a bare union. */
export const BORDER_TONES = ["default", "strong", "accent"] as const;
