import type { CSSProperties } from "react";

/**
 * Blinking block cursor at ~0.94Hz. The frequency is capped by the token, not
 * by this component: WCAG 2.3.1 (Level A) prohibits flashing above 3Hz.
 */
export function BlinkCursor({ char = "█", style }: { char?: string; style?: CSSProperties }) {
  return (
    <span aria-hidden="true" className="nx-blink" style={style}>
      {char}
    </span>
  );
}
