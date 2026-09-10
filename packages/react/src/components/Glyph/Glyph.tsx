import type { ReactNode } from "react";
import type { GlyphShape } from "../../types.js";
import { iconA11y, resolveColour } from "../../colour.js";
import type { ToneProps } from "../../colour.js";

export const GLYPH_SHAPES: readonly GlyphShape[] = [
  "circle",
  "hexagon",
  "diamond",
  "ring",
  "square",
  "triangle",
] as const;

const PATHS: Record<Exclude<GlyphShape, "ring">, ReactNode> = {
  circle: <circle cx="7" cy="7" r="4.3" />,
  hexagon: <polygon points="7,2.4 11,4.8 11,9.2 7,11.6 3,9.2 3,4.8" />,
  diamond: <polygon points="7,2.2 11.4,7 7,11.8 2.6,7" />,
  square: <rect x="3.2" y="3.2" width="7.6" height="7.6" />,
  triangle: <polygon points="7,2.3 11.6,10.6 2.4,10.6" />,
};

export interface GlyphProps extends ToneProps {
  shape?: GlyphShape;
  size?: number;
  /** Supply when the glyph carries meaning; omit when it is decorative. */
  title?: string;
}

/**
 * Six distinct silhouettes. This is what satisfies WCAG 1.4.1 — category is
 * never communicated by colour alone.
 */
export function Glyph({
  shape = "circle",
  tone,
  colour,
  muted = false,
  size = 13,
  title,
}: GlyphProps) {
  const c = resolveColour({ tone, colour, muted }, "var(--nx-fg-info)");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...iconA11y(title)}
      style={{ flexShrink: 0, filter: muted ? "none" : `drop-shadow(0 0 4px ${c})` }}
    >
      {shape === "ring" ? (
        <circle cx="7" cy="7" r="4.1" fill="none" strokeWidth="2.1" stroke={c} />
      ) : (
        <g fill={c}>{PATHS[shape]}</g>
      )}
    </svg>
  );
}
