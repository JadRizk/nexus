import type { ReactNode } from "react";

/* ============================================================================
   @nexus/react — shared types

   Types only. The hooks that used to live here are in ./hooks.ts and the
   search ranker is in ./search.ts.
   ========================================================================== */

export type GlyphShape = "circle" | "hexagon" | "diamond" | "ring" | "square" | "triangle";
export type Corner = "tl" | "tr" | "bl" | "br";

/** A CSS colour. Prefer a `tone` prop over a literal wherever one exists. */
export type Colour = string;

export interface LegendGroup {
  title: string;
  rows: ReactNode;
}
