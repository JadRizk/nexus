import type { CSSProperties, ReactNode } from "react";
import { resolveColour } from "../../colour.js";
import type { ToneProps } from "../../colour.js";

export interface StatProps extends ToneProps {
  label: ReactNode;
  value: ReactNode;
  style?: CSSProperties;
}

export function Stat({ label, value, tone, colour, style }: StatProps) {
  return (
    <div
      className="nx-stat"
      // Computed from props, so it cannot live in the stylesheet.
      style={
        {
          "--nx-stat-value-fg": resolveColour({ tone, colour }, "var(--nx-fg-default)"),
          ...style,
        } as CSSProperties
      }
    >
      <div className="nx-stat__label">{label}</div>
      <div className="nx-stat__value">{value}</div>
    </div>
  );
}
