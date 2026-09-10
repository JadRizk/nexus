import type { CSSProperties } from "react";
import { mergeClassName } from "../../className.js";

export interface HazardRuleProps {
  height?: number;
  opacity?: number;
  className?: string;
  style?: CSSProperties;
}

/** Diagonal warning stripe. Decorative — hidden from assistive tech. */
export function HazardRule({ height, opacity, className = "", style }: HazardRuleProps) {
  return (
    <div
      aria-hidden="true"
      className={mergeClassName("nx-hazard", className)}
      style={
        {
          ...(height != null ? { "--nx-hazard-height": `${height}px` } : null),
          ...(opacity != null ? { "--nx-hazard-opacity": String(opacity) } : null),
          ...style,
        } as CSSProperties
      }
    />
  );
}
