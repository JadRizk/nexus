import { tone as toneVar } from "@nexus/tokens";
import type { Tone } from "@nexus/tokens";
import type { Colour } from "./types.js";

/* ============================================================================
   @nexus/react — colour resolution

   Every component that carries a colour takes the same pair of props, so
   "what colour is this" has one spelling across the whole API rather than the
   three it used to have (`colour` on the glyphs, `accent` on the overlays,
   `tone` on Stat).
   ========================================================================== */

export interface ToneProps {
  /**
   * Semantic foreground role — the preferred route. Resolves to the matching
   * `--nx-fg-*` custom property, so it follows a theme swap for free.
   */
  tone?: Tone;
  /**
   * Raw CSS colour, for a category that genuinely has no semantic role: a
   * graph node class with its own hex, a chart series. This is not a way
   * around the token system, it is the other half of it — `tone` covers the
   * nine roles the system names, `colour` covers data the system can't name.
   *
   * Ignored when `tone` is also set.
   */
  colour?: Colour;
}

/** `tone` wins over `colour`; `fallback` applies when neither is given. */
export function resolveColour(
  { tone, colour }: ToneProps,
  fallback: string,
): string {
  if (tone) return toneVar(tone);
  return colour ?? fallback;
}
