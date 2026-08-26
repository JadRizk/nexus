import type { CSSProperties, ReactNode } from "react";
import { resolveColour } from "../../colour.js";
import type { ToneProps } from "../../colour.js";

export interface TooltipProps extends ToneProps {
  x: number;
  y: number;
  children: ReactNode;
  style?: CSSProperties;
}

export function Tooltip({ x, y, tone, colour, children, style }: TooltipProps) {
  return (
    <div
      role="tooltip"
      className="nx-tooltip"
      // Position follows a pointer and the accent follows the subject's
      // category: both are only knowable at render.
      style={{
        left: x,
        top: y,
        "--nx-tooltip-accent": resolveColour({ tone, colour }, "var(--nx-fg-info)"),
        ...style,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
