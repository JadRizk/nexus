import type { ReactNode } from "react";

export type GlyphShape = "circle" | "hexagon" | "diamond" | "ring" | "square" | "triangle";
export type Corner = "tl" | "tr" | "bl" | "br";

/** A CSS colour. Prefer a `tone` prop over a literal wherever one exists. */
export type Colour = string;

export interface LegendGroup {
  title: string;
  rows: ReactNode;
}
