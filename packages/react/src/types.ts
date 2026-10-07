import type { ReactNode } from "react";

/* ============================================================================
   @nexus-cyberdeck/react — shared types

   Types only. The hooks live in ./hooks/ and the search ranker in
   ./search/.
   ========================================================================== */

export type GlyphShape = "circle" | "hexagon" | "diamond" | "ring" | "square" | "triangle";
export type Corner = "tl" | "tr" | "bl" | "br";

/** A CSS colour. Prefer a `tone` prop over a literal wherever one exists. */
export type Colour = string;

export interface LegendGroup {
  title: string;
  rows: ReactNode;
}
