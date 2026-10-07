import { tone as toneVar } from "@nexus-cyberdeck/tokens";
import type { Tone } from "@nexus-cyberdeck/tokens";
import type { Colour } from "./types.js";

/* ============================================================================
   @nexus-cyberdeck/react — colour resolution

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
  /**
   * Overrides both, routing to the disabled tone regardless of what was
   * asked for — a category can be temporarily de-emphasised (a hidden
   * legend entry, a filtered-out node class) without losing its `tone`/
   * `colour` for when it's switched back on.
   */
  muted?: boolean;
}

/** `muted` wins over `tone`, which wins over `colour`; `fallback` applies when none apply. */
export function resolveColour({ tone, colour, muted }: ToneProps, fallback: string): string {
  if (muted) return toneVar("disabled");
  if (tone) return toneVar(tone);
  return colour ?? fallback;
}

/**
 * `role`/`aria-label`/`aria-hidden` for an icon `<svg>`: announced as an
 * image when it carries meaning, hidden from assistive tech when it's
 * decorative. Shared because `Glyph` and `LinkGlyph` both need exactly this
 * and nothing else — the icon's `title` prop is the only input.
 */
export function iconA11y(title?: string): {
  role?: "img";
  "aria-label"?: string;
  "aria-hidden"?: true;
} {
  return title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
}
