import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { resolveColour } from "../../colour.js";
import type { ToneProps } from "../../colour.js";

export interface TooltipProps extends ToneProps {
  x: number;
  y: number;
  children: ReactNode;
  style?: CSSProperties;
  /** Lets a subject reference this tooltip with aria-describedby. */
  id?: string;
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip({ x, y, tone, colour, children, style, id }, ref) {
    return (
      <div
        ref={ref}
        id={id}
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
  },
);

Tooltip.displayName = "Tooltip";
