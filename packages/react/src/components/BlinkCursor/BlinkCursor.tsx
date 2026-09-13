import { forwardRef } from "react";
import type { CSSProperties } from "react";

export interface BlinkCursorProps {
  char?: string;
  style?: CSSProperties;
}

/**
 * Blinking block cursor at ~0.94Hz. The frequency is capped by the token, not
 * by this component: WCAG 2.3.1 (Level A) prohibits flashing above 3Hz.
 */
export const BlinkCursor = forwardRef<HTMLSpanElement, BlinkCursorProps>(
  function BlinkCursor({ char = "█", style }, ref) {
    return (
      <span ref={ref} aria-hidden="true" className="nx-blink" style={style}>
        {char}
      </span>
    );
  },
);

BlinkCursor.displayName = "BlinkCursor";
