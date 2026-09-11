import { forwardRef } from "react";
import { iconA11y, resolveColour } from "../../colour.js";
import type { ToneProps } from "../../colour.js";

export interface LinkGlyphProps extends ToneProps {
  dashed?: boolean;
  arrow?: boolean;
  width?: number;
  size?: number;
  title?: string;
}

/** Relation glyph: curve, optional dash pattern, optional arrowhead. */
export const LinkGlyph = forwardRef<SVGSVGElement, LinkGlyphProps>(
  function LinkGlyph(
    { tone, colour, dashed = false, arrow = false, width = 1.2, muted = false, size = 13, title },
    ref,
  ) {
    const c = resolveColour({ tone, colour, muted }, "var(--nx-fg-info)");
    return (
      <svg ref={ref} width={size} height={size} viewBox="0 0 14 14"
        {...iconA11y(title)}
        style={{ flexShrink: 0 }}>
        <path d="M1 9.5 Q7 2 13 9.5" fill="none" stroke={c} strokeWidth={width}
          strokeDasharray={dashed ? "2.2 1.9" : undefined} strokeLinecap="round" />
        {arrow && <polygon points="13,9.5 10,7.8 10.7,10.9" fill={c} />}
      </svg>
    );
  },
);

LinkGlyph.displayName = "LinkGlyph";
