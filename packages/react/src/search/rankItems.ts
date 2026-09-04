/* ============================================================================
   @nexus-cyberdeck/react — search

   The ranking policy CommandPalette applies to its items. It lives here
   rather than inside the component so it can be tested, reasoned about and
   (eventually) swapped without touching any rendering code.
   ========================================================================== */

import type { Colour, GlyphShape } from "../types.js";

export interface PaletteItem {
  id: string | number;
  label: string;
  /** Short class code shown on the right of a result row. */
  code?: string;
  shape?: GlyphShape;
  colour?: Colour;
  /** Tie-breaker when text scores match. Higher sorts first. */
  weight?: number;
}

/**
 * Ranked search. Deliberately not fuzzy: in a structured corpus you usually
 * know the beginning of what you want, and fuzzy matching mostly produces
 * confident nonsense. Order: exact, prefix, word-start, contains, code.
 */
export function rankItems<T extends PaletteItem>(items: readonly T[], query: string, limit = 40): T[] {
  const needle = query.trim().toLowerCase();
  const scored: Array<[number, T]> = [];

  for (const it of items) {
    const name = String(it.label).toLowerCase();
    let score: number;
    if (!needle) score = 40;
    else if (name === needle) score = 100;
    else if (name.startsWith(needle)) score = 80;
    else if (name.includes(`_${needle}`) || name.includes(`#${needle}`) || name.includes(` ${needle}`)) score = 65;
    else if (name.includes(needle)) score = 50;
    else if (String(it.code ?? "").toLowerCase().startsWith(needle)) score = 45;
    else continue;
    scored.push([score * 1000 + (it.weight ?? 0), it]);
  }

  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(([, it]) => it);
}
